# 代码工程全面审计与工程化改进规格书

**文档编号**：PDOOM-AUDIT-2026-022
**审计日期**：2026-09-29
**审计范围**：`/Users/ic/Copyright/pdoom-video/app/` 全量源码（含 `engine/`、`plugins/`、`scenes/`、`studio-app.ts`、`studio.ts`、`main.ts`、`studio.html`、`vite.config.ts`、`package.json`、`tsconfig.json`、构建脚本与曲目资源包）
**审计人**：Antigravity Opus 4.6
**方法论**：事实本位 (Fact-Centric)，零润滑沟通 (Zero-Lubrication)，纯干货推导

---

## 1. 代码资产全景度量

| 度量维度 | 数值 |
| --- | --- |
| TypeScript 总源码行数 | **27,908 行** |
| `scenes/` 原版定制场景 | 40 个文件，**19,602 行**（70.2%） |
| `plugins/` 通用可复用插件 | 20 个文件，**3,149 行**（11.3%） |
| `engine/` 核心渲染引擎 | 15 个文件 + 1 个 GLSL 子目录，**3,138 行**（11.2%） |
| 工作台 (`studio-app.ts` + `studio.ts` + `studio.html` + `studio.css`) | 4 个文件，**2,956 行**（10.6%）|
| 主入口 (`main.ts` + `timeline.ts`) | 2 个文件，**381 行** |
| 运行时依赖 | `three.js` (0.186)、`opentype.js` (2.0) |
| 开发依赖 | `vite` (8.3)、`playwright-core` (1.63)、TypeScript (7.0 peer) |
| `node_modules/` 磁盘占用 | 126 MB |
| 曲目资源包 (`demo`) | `audio.json` 755 KB + `audio.mp3` 3.4 MB + `lyrics.json` 31 KB + `timeline.json` 2.5 KB |

---

## 2. 架构层审计

### 2.1 架构全景拓扑

```
┌───────────────────────────────────────────────────────────┐
│  index.html (播放器)  │  studio.html (工作台)             │  入口层
├───────────────────────┼───────────────────────────────────┤
│  main.ts (路由/引导)  │  studio-app.ts (管理UI逻辑)       │  应用层
│                       │  studio.ts (嵌入式工作台旧版)      │
├───────────────────────┴───────────────────────────────────┤
│              engine/ (核心渲染引擎)                         │  引擎层
│  engine.ts   scene.ts   gl.ts   post.ts   audio.ts        │
│  lyrics.ts   hud.ts    lines.ts  stroke.ts  type.ts       │
│  timeline-loader.ts   tag-system.ts   util.ts  palette.ts │
│  scale.ts   glsl/common.ts                                │
├───────────────────────────────────────────────────────────┤
│  plugins/ (19 个通用效果器 + bespoke-helper)               │  插件层
├───────────────────────────────────────────────────────────┤
│  scenes/ (40 个原版硬编码场景)                              │  遗产层
├───────────────────────────────────────────────────────────┤
│  timeline.ts (原版硬编码编排)                               │  编排层
│  tracks/{name}/timeline.json (数据驱动编排)                 │
├───────────────────────────────────────────────────────────┤
│  tracks/{name}/audio.json + lyrics.json + audio.mp3       │  资源层
└───────────────────────────────────────────────────────────┘
```

### 2.2 架构结构性缺陷

* **缺陷 A-01：工作台双重实现冗余**
  1. `studio.ts`（494 行）实现了嵌入式 `StudioWorkbench` 类，以 DOM 字符串拼接方式构建 UI。
  2. `studio-app.ts`（1,147 行）实现了完全独立的 `StudioApp` 类，同样以 DOM 字符串拼接方式构建 UI。
  3. 两者之间无共享抽象、无组件复用，存在功能重叠区：时间轴编排、视效选择、保存等核心交互在两处独立实现。
  4. **物理事实**：`studio.ts` 的 `StudioWorkbench` 被 `main.ts` 间接引用（通过 `import './studio.css'`），`studio-app.ts` 的 `StudioApp` 被 `studio.html` 独立引用。两套代码各自管理状态，无法互通。
  5. **改进建议**：废弃 `studio.ts`，将所有工作台逻辑统一到 `studio-app.ts`。如果需要嵌入式面板，从 `studio-app.ts` 抽取共享模块。

* **缺陷 A-02：scenes/ 目录 19,602 行代码无隔离无版本控制约束**
  1. 40 个原版场景文件各自 200~1,500 行不等，内联 GLSL 着色器字符串、3D 几何构建、2D Canvas 绘制、业务逻辑、动画状态管理。
  2. 场景之间通过 `_motifs.ts`、`*-glsl.ts`、`*-geo.ts`、`*-kit.ts` 等辅助文件形成隐式耦合树，但无显式依赖声明或接口契约。
  3. 场景代码与引擎接口的契约仅依赖 `Scene` 抽象类的 `render(f: Frame, out: RT)` 签名，但场景内部大量直接访问 `this.ctx.renderer`、`this.ctx.lyrics`、`this.ctx.audio` 的深层方法，形成隐式紧耦合。
  4. **改进建议**：将 `scenes/` 明确标记为 "legacy/bespoke"，禁止新增。所有新视效开发强制通过 `plugins/` 路径，并引入 `PluginManifest` 元数据文件 (`plugin.meta.json`) 声明依赖、标签、版本。

* **缺陷 A-03：tag-system.ts 同时承担数据定义、匹配算法和装配逻辑三重职责**
  1. 单个文件 441 行，包含：
     - 标签定义常量 (`AESTHETIC_STYLES`, `SEMANTIC_IMAGERIES`, `ACOUSTIC_METRICS`)
     - 插件元数据注册表 (`PLUGIN_REGISTRY`)
     - 调色配置 (`COLOR_GRADES`)
     - 匹配算法 (`matchOptimalVisualPlugin`)
     - 装配推荐器 (`assembleLayeredLens`)
     - 图层检索 (`getPluginsByLayer`)
  2. 所有标签定义硬编码在源码中，无法通过外部 JSON 配置扩展。新增插件/标签必须改代码。
  3. `matchOptimalVisualPlugin` 中的正则匹配规则硬编码了 15 组 `{ pattern, plugin, tagId, rationale }`，顺序决定优先级，但无权重系统。
  4. **改进建议**：
     - 拆分为 `tag-definitions.json`（纯数据）、`plugin-registry.json`（纯数据）、`tag-matcher.ts`（算法）、`lens-assembler.ts`（装配逻辑）。
     - 标签与插件注册表外置为 JSON 资产，支持运行时热加载与工作台在线编辑。

* **缺陷 A-04：timeline.json DSL 冗余字段 `scene` 与 `plugin` 并存**
  1. 当前 `TimelineDSLItem` 接口同时定义 `scene?: string` 和 `plugin?: string`，`timeline-loader.ts` 以 `item.plugin ?? item.scene ?? 'typography'` 的优先级消歧。
  2. `MASTERPIECE_PRESET` 中每个条目同时填写了 `plugin` 和 `scene` 两个字段且值相同。
  3. `layer` 字段在 DSL 中声明为字符串 `'foreground'`，但引擎从未读取此字段，属于冗余数据。
  4. **改进建议**：废弃 `scene` 字段，统一使用 `plugin` 作为模块定位符；移除无效的 `layer` 字段；引入 JSONSchema 对 `timeline.json` 做编译期校验。

### 2.3 架构优势（客观记录）

* 引擎核心 (`engine.ts`) 的确定性渲染架构设计极为扎实：
  - 三进制自适应运动模糊 (`ternaryOffsets`) 数学正确，避免了二进制倍增的时间偏移采样误差。
  - 多层正交混合器 (`composite`) 支持 `layerIndex` 稳定排序 + `BlendMode` 分离，逻辑清晰。
  - `readPixelsAsync` 利用 PBO fence 异步回读，比阻塞式 `readPixels` 快 2~3 倍。
* `Frame` 数据总线接口设计齐全：`t`, `dt`, `lt`, `p`, `beat`, `bar`, `beatPhase`, `barPhase`, `a`, `tin`, `tout`, `downbeat`, `kickImpulse`, `snareImpulse`, `hatImpulse`, `energy`, `layerIndex`，为插件提供了丰富的驱动信号。
* `AudioData` 的连续节拍插值 (`beatAt`, `barAt`) 使用二分查找，算法复杂度 $O(\log n)$，性能可靠。

---

## 3. 代码质量审计

### 3.1 类型安全

| 问题编号 | 位置 | 问题描述 | 严重度 |
| --- | --- | --- | --- |
| Q-01 | `engine.ts:32` | `params?: Record<string, any>` 使用 `any` 类型，丧失插件参数的类型安全 | 中 |
| Q-02 | `engine.ts:215` | `updateTimelineDSL(dsl: any[])` 入参为 `any[]`，应使用 `TimelineDSLItem[]` | 中 |
| Q-03 | `scene.ts:19` | `SceneCtx.params: Record<string, any>` 同样使用 `any` | 中 |
| Q-04 | `scene.ts:57-65` | `Frame` 接口中 `downbeat`, `kickImpulse`, `snareImpulse`, `hatImpulse`, `energy`, `layerIndex` 全部标记为 `optional (?)`，但 `engine.ts:243-253` 中 `frameFor` 始终赋值。Optional 标记误导消费者做空值检查。 | 中 |
| Q-05 | `studio-app.ts` 全局 | 大量 `as any` 强制转换，尤其是 DOM 事件回调中 | 低 |
| Q-06 | `bespoke-helper.ts:18` | `GenericSceneParams` 使用 `[key: string]: any` 索引签名，等同于关闭类型检查 | 中 |

**改进建议**：
1. 将 `Frame` 中 `downbeat` 等字段从 `optional` 改为 `required`——引擎保证填充。
2. 为每个插件定义具体的 `Params` 类型接口，替代 `Record<string, any>`。至少定义一个 `BasePluginParams` 约束公共字段。
3. 在 `tsconfig.json` 中启用 `noUncheckedIndexedAccess: true`，强制索引访问返回 `T | undefined`。

### 3.2 错误处理

| 问题编号 | 位置 | 问题描述 | 严重度 |
| --- | --- | --- | --- |
| E-01 | `main.ts:64,72` | `catch {}` 空处理块，吞没 JSON 解析与 fetch 错误 | 高 |
| E-02 | `studio.ts:41` | `catch {}` 吞没 fetch `/api/plugins` 错误 | 中 |
| E-03 | `studio-app.ts:154,161` | `catch {}` 吞没工作台数据加载错误 | 中 |
| E-04 | `typography.ts:36` | `catch {}` 吞没歌词查询失败 | 低 |
| E-05 | `timeline-loader.ts:71,87` | `catch {}` 吞没歌词 `startQuery`/`endQuery` 解析错误，静默回退到 0 或 duration | 高 |
| E-06 | `engine.ts:406-409` | 场景 `render` 异常被 catch 后仅 `console.error`，用红色纯色填充画面，但无用户级错误上报通道 | 中 |

**改进建议**：
1. 禁止空 `catch {}` 块。至少记录 `console.warn` 并附带上下文：`catch (e) { console.warn('[timeline-loader] startQuery parse failed:', item.startQuery, e); }`。
2. 引入结构化错误收集器 `ErrorCollector`，将引擎/场景/时间轴解析错误统一推送到 `engine.errors[]`，工作台 UI 可订阅并显示。
3. `timeline-loader.ts` 中的 `catch {}` 静默回退（start → 0, end → duration）会产生覆盖全曲的超长切片，应当用 `NaN` 标记并在下游过滤。

### 3.3 资源生命周期管理

| 问题编号 | 位置 | 问题描述 | 严重度 |
| --- | --- | --- | --- |
| R-01 | `plugins/` 全部 20 个插件 | **零 `dispose()` 实现**。每个插件创建 `FSPass`、`Layer2D`、`LineBatch`、`THREE.WebGLRenderTarget` 等 GPU 资源，但没有一个实现 `dispose()` 释放 | **高** |
| R-02 | `scenes/` 40 个场景中仅 `bureau.ts` 和 `shoggoth.ts` 实现了 `dispose()` | 其余 38 个场景创建了大量 GPU 资源但从未释放 | 高 |
| R-03 | `engine.ts:216-218` | `updateTimelineDSL` 调用 `rec.scene?.dispose()` 后 `this.loaded.clear()`，但如果插件没有实现 `dispose()`，GPU 内存只能等 GC 被动回收 | 高 |
| R-04 | `gl.ts:192-201` | `Layer2D` 创建 `HTMLCanvasElement` 和 `THREE.CanvasTexture`，无 `dispose` 方法 | 中 |

**改进建议**：
1. **最高优先级**：为 `Scene` 基类提供非抽象的默认 `dispose()` 实现，自动遍历实例上所有 `FSPass`、`Layer2D`、`LineBatch`、`THREE.WebGLRenderTarget` 类型的属性并释放。可利用 TypeScript 装饰器或约定命名（所有可释放资源注册到 `this._disposables: Disposable[]`）。
2. 为 `Layer2D` 添加 `dispose()` 方法：`this.texture.dispose(); this.canvas.remove();`。
3. 在 `engine.ts` 的 `updateTimelineDSL` 中增加 GPU 资源泄漏检测日志：比较 `renderer.info.memory` 快照前后差异。

### 3.4 代码重复

| 问题编号 | 涉及文件 | 问题描述 |
| --- | --- | --- |
| D-01 | 所有 plugins 中的 `render()` 方法 | 歌词流式嵌入模式代码高度重复：`resolveLines → getRenderableLyric → layer.clear() → renderEmbeddedLyric → comp.draw`，15+ 个插件包含几乎相同的 10~15 行代码块 |
| D-02 | `terrain.ts`, `tunnel.ts`, `room-terminal.ts` 等 | `FSPass` 构建模式重复：`uniform float t; uniform float beat; uniform float kick;` 等 uniform 声明在多个着色器中重复 |
| D-03 | `studio.ts` 与 `studio-app.ts` | 预设常量 `allPlugins` 列表在两处独立维护，随新插件增长同步维护成本线性增长 |
| D-04 | `MASTERPIECE_PRESET` 与 `LAYERED_CINEMA_PRESET` | 预设时间轴数据硬编码在 `studio-app.ts` 中（~130 行），应当外置为 JSON |

**改进建议**：
1. 抽取 `PluginBase` 基类或 mixin，封装歌词嵌入流水线：
   ```typescript
   abstract class LyricAwarePlugin extends Scene {
     protected lines: Line[] = [];
     protected layer = new Layer2D();
     override async init() {
       this.lines = BespokeSceneHelper.resolveLines(this.ctx, this.ctx.params);
     }
     protected renderLyrics(f: Frame, out: THREE.WebGLRenderTarget, opts: LyricRenderOptions) {
       if (this.lines.length === 0) return;
       const lyric = BespokeSceneHelper.getRenderableLyric(this.lines, f.t);
       this.layer.clear();
       BespokeSceneHelper.renderEmbeddedLyric(this.layer.ctx, lyric, f, opts);
       this.ctx.comp.draw(this.ctx.renderer, this.layer.upload(), out, { mode: 'normal' });
     }
   }
   ```
2. 将通用 GLSL uniform 声明抽取为共享片段 `glsl/frame-bus.glsl`：`uniform float t; uniform float beat; uniform float kick; ...`。
3. 预设数据外置为 `public/presets/masterpiece.json` 和 `public/presets/layered-cinema.json`。

---

## 4. 性能瓶颈审计

### 4.1 渲染管线

| 问题编号 | 位置 | 分析 | 影响 |
| --- | --- | --- | --- |
| P-01 | `engine.ts:372-374` | `this.timeline.filter(e => t >= e.start && t < e.end)` 每帧线性扫描全部条目。5 层正交 × 16 幕 = 80 条目时，每帧 80 次比较 | 低（N 较小） |
| P-02 | `engine.ts:379-436` | 多层合成中每个活跃图层独立 `clearRT` + `render` + `comp.draw`，5 层正交模式单帧可能触发 10+ 次 RT 切换和全屏绘制 | 中 |
| P-03 | `audio.ts:94-100` | `sample(t)` 每次调用执行 8 次 `env()` + 4 次 `hit()`。`hit()` 内部二分查找 + 回溯 6 条 onset，合计 ~50 次数组访问。每帧调用 1 次，可接受；但 motion blur 模式下每子帧调用 1 次，108 子帧 = 5,400 次 | 中 |
| P-04 | `lyrics.ts:49-51,53-56` | `lineAt` 和 `lastLine` 线性扫描全部歌词行。46 行歌词下可忽略，但接口设计不具备扩展性 | 低 |
| P-05 | `hud.ts` (未深入) | HUD 每帧重新绘制 Canvas2D 内容并 upload 纹理，Canvas2D 绘制是 CPU 密集操作 | 低~中 |
| P-06 | `Layer2D.upload()` | 每次调用 `this.texture.needsUpdate = true`，three.js 内部执行 `texImage2D` 全量重传。多个插件各持一个 `Layer2D`，5 层模式下每帧最多 5 次全屏纹理上传 | 中 |

**改进建议**：
1. 为 `timeline` 维护排序索引 + 上次查询缓存，避免每帧线性扫描。
2. `audio.sample(t)` 结果缓存：同一帧多次子帧调用中 `t` 变化微小，可用 dirty flag 避免重复计算。
3. `Layer2D` 引入脏标记 (`isDirty`)，仅在实际内容变化时才 `upload()`。纯器乐期间歌词隐去，无需每帧上传空白纹理。
4. 考虑将 HUD 的 Canvas2D 绘制拆分为静态部分（裁切标记、边框）和动态部分（时间码、P(doom) 数值），静态部分仅初始化时绘制一次。

### 4.2 内存占用

| 资源类型 | 估算数量 | 估算显存占用 |
| --- | --- | --- |
| `makeRT()` (1920×1080 HalfFloat RGBA) | 引擎持有 8 个 RT | 8 × 16.6 MB = **132.5 MB** |
| Bloom 金字塔 (`post.ts` MIPS=7) | 14 个低分辨率 RT | ~15 MB |
| 每个插件 `Layer2D` (1920×1080 Canvas) | 最多 5 个活跃 | 5 × 8.3 MB = **41.5 MB** |
| `LineBatch` 顶点缓冲 (16000 segments) | 每个 ~2 MB | 5 × 2 = **10 MB** |
| 合计估算 | | **~200 MB** GPU VRAM |

对于 M3 Ultra 96GB UMA 机器影响极小，但对于 8GB 集显笔记本将构成瓶颈。

**改进建议**：
1. 插件的 `Layer2D` 和 `LineBatch` 应延迟创建（仅在第一次 `render` 时实例化），并在不活跃时释放。
2. 引擎应当维护一个 RT 对象池 (`RTPool`)，按需分配和回收，避免常驻 8+ 个全尺寸 RT。

---

## 5. 安全与健壮性审计

### 5.1 XSS 向量

| 问题编号 | 位置 | 风险描述 |
| --- | --- | --- |
| S-01 | `main.ts:99-121` | `banner.innerHTML` 模板中内联 `${EFFECT}` 和 `${TRACK}` 变量，均来自 URL 参数 `?effect=` 和 `?track=`，**未经转义直接注入 HTML**。攻击者可构造恶意 URL 注入任意脚本 | 
| S-02 | `studio.ts:45` 及 `studio-app.ts:174,931,947,1033` | `innerHTML` 大量使用模板字符串拼接用户可控数据 |
| S-03 | `main.ts:295` | `insertAdjacentHTML('beforeend', ...)` 注入错误堆栈，如果错误消息包含 HTML 标签可被利用 |

**改进建议**：
1. 实现 `escapeHtml(s: string)` 工具函数，对所有来自 URL 参数或用户输入的变量在注入 HTML 前进行转义：
   ```typescript
   const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
   ```
2. 考虑引入 `DOMPurify` 或使用 `textContent` 替代 `innerHTML` 设置纯文本。

### 5.2 Vite API 端点安全

| 问题编号 | 位置 | 风险描述 |
| --- | --- | --- |
| S-04 | `vite.config.ts:10-27` | `/api/save-timeline` 端点接受任意 JSON 写入 `public/tracks/{track}/timeline.json`。`track` 参数未校验路径穿越，攻击者可通过 `track=../../etc/passwd%00` 尝试路径穿越写入 |
| S-05 | `vite.config.ts:30-42` | `/api/plugins` 端点暴露 `src/plugins/` 目录下的文件列表 |

**改进建议**：
1. 对 `track` 参数做白名单校验：仅允许 `[a-zA-Z0-9_-]`，禁止 `..`、`/`、`\0`。
2. 限制 timeline JSON 体积上限（如 1 MB）以防 DoS。
3. 这些端点仅在开发模式 (`configureServer`) 中注册，生产构建不暴露，风险受限于本地开发环境。

---

## 6. 可维护性审计

### 6.1 文件单体膨胀

| 文件 | 行数 | 问题 |
| --- | --- | --- |
| `studio-app.ts` | 1,147 | 单文件承载全部工作台 UI 构建、事件绑定、数据管理、预设定义。应拆分为 `studio-timeline-panel.ts`, `studio-effects-panel.ts`, `studio-song-pipeline.ts`, `studio-presets.ts` |
| `bespoke-helper.ts` | 467 | 承载歌词解析、流式轮播状态机、嵌入式渲染、焦点词提取、调速计算。应拆分为 `lyric-resolver.ts`, `lyric-carousel.ts`, `lyric-renderer.ts` |
| `tag-system.ts` | 441 | 同上 §2.2 缺陷 A-03 |
| `engine.ts` | 460 | 承载初始化、多层合成、运动模糊自适应采样、帧数据构建、HMR 重载。尚可接受但接近拆分阈值 |

### 6.2 缺失基础设施

| 缺失项 | 影响 | 优先级 |
| --- | --- | --- |
| **ESLint / Biome 配置** | 无自动化代码风格强制，`console.log` 泄漏、未使用变量无检查 | 高 |
| **Prettier 配置** | 代码格式不一致（部分文件单行 if，部分多行） | 中 |
| **单元测试框架** | 零单元测试。`util.ts` 中的 `clamp`, `lerp`, `smoothstep`, `ease.*` 全部无测试覆盖 | 高 |
| **CI/CD Pipeline** | 无 `package.json` 中的 `scripts`（无 `lint`, `test`, `typecheck` 脚本） | 高 |
| **CHANGELOG / CONTRIBUTING** | 无变更日志，无贡献指南 | 低 |
| **`package.json` scripts** | 当前 `package.json` 零 `scripts` 字段定义 | 高 |

**改进建议**：
1. 在 `package.json` 中添加：
   ```json
   "scripts": {
     "dev": "vite --port 5173",
     "build": "tsc --noEmit && vite build",
     "typecheck": "tsc --noEmit",
     "lint": "biome check src/",
     "test": "vitest run",
     "preview": "vite preview"
   }
   ```
2. 引入 `vitest` 作为测试框架（与 Vite 零配置集成），首先覆盖 `engine/util.ts` 和 `engine/audio.ts` 的纯函数。
3. 引入 `@biomejs/biome` 作为 lint + format 工具（零配置、极速）。

### 6.3 文档与注释

* 引擎层注释质量优秀：`engine.ts`、`gl.ts`、`scene.ts`、`post.ts` 均有详细的 JSDoc 注释和设计意图说明。
* 插件层注释不均：`terrain.ts` 有中文注释说明每个 uniform 的物理含义；`kinetic-press.ts` 有液压阶段状态机的文字描述；但 `glitch.ts`、`tunnel.ts` 等较简短的插件注释偏少。
* 工作台层 (`studio-app.ts`) 注释密度极低：1,147 行代码中仅有文件头部 2 行注释和少数内联中文标签。

---

## 7. 构建与依赖审计

### 7.1 依赖链评估

| 依赖 | 版本 | 风险评估 |
| --- | --- | --- |
| `three` | 0.186.0 | 稳定主干。当前 WebGLRenderer API 使用正确。WebGPU 迁移路径需关注 `three.js` 的 `WebGPURenderer` 分支进度 |
| `opentype.js` | 2.0.0 | 字体解析库，用于 `stroke.ts` 的单笔画光学字距引擎。稳定 |
| `vite` | 8.3.0 | 构建工具。`import.meta.glob` 用于 lazy 加载 scenes/plugins，依赖 Vite 特有语法 |
| `playwright-core` | 1.63.0 | 仅用于 `scripts/` 下的验证脚本，非运行时依赖，放在 `devDependencies` 正确 |
| `@types/bun` | latest | 声明 Bun 运行时类型。**问题：项目实际由 Vite 构建，不直接使用 Bun 运行时 API，此依赖可能为误加** |

### 7.2 构建配置

* `tsconfig.json` 中 `strict: true` 已启用，良好。
* **缺失 `noUncheckedIndexedAccess`**：数组/对象索引访问不会返回 `undefined`，可能导致运行时 undefined 引用。
* `verbatimModuleSyntax: false`：允许 type-only import 不显式标记 `type`，降低代码可读性。
* `build.target: 'esnext'`：输出不做降级转译，要求用户浏览器支持最新 ES 特性（顶级 await、import.meta 等）。对于本地开发工具可接受。

---

## 8. 工程化改进优先级矩阵

| 优先级 | 改进项 | 影响范围 | 预估工时 |
| --- | --- | --- | --- |
| **P0 (阻断级)** | 插件 `dispose()` 资源释放 | GPU 内存泄漏 | 4h |
| **P0** | 空 `catch {}` 块改为有意义的错误记录 | 调试效率 | 2h |
| **P0** | `innerHTML` XSS URL 参数转义 | 安全 | 1h |
| **P1 (高优)** | `package.json` scripts 补全 | 构建流程 | 0.5h |
| **P1** | 引入 Biome lint + format | 代码质量 | 1h |
| **P1** | 引入 Vitest + 核心纯函数单元测试 | 质量保障 | 4h |
| **P1** | `Frame` 接口 optional 字段修正为 required | 类型安全 | 1h |
| **P1** | 废弃 `studio.ts` 合并到 `studio-app.ts` | 消除冗余 | 3h |
| **P1** | `tag-system.ts` 拆分数据/算法/装配 | 可维护性 | 3h |
| **P2 (中优)** | 歌词嵌入代码抽取 `LyricAwarePlugin` 基类 | 减少重复 | 2h |
| **P2** | 标签/插件注册表外置为 JSON | 可扩展性 | 2h |
| **P2** | `Layer2D` 脏标记优化 | 性能 | 1h |
| **P2** | 预设数据外置为 JSON | 可维护性 | 1h |
| **P2** | Vite API 端点路径穿越防护 | 安全 | 0.5h |
| **P2** | `tsconfig.json` 启用 `noUncheckedIndexedAccess` | 类型安全 | 2h（修复全量类型错误） |
| **P3 (低优)** | RT 对象池 | 内存优化 | 3h |
| **P3** | `audio.sample()` 缓存 | 性能 | 1h |
| **P3** | HUD 静态/动态拆分 | 性能 | 2h |
| **P3** | `scenes/` 标记为 legacy 并冻结 | 架构治理 | 1h |
| **P3** | `timeline.json` JSONSchema 校验 | 数据契约 | 2h |

---

## 9. 重点改进方案详述

### 9.1 方案一：统一资源释放体系

**目标**：消除 GPU 内存泄漏，确保场景/插件热替换后显存完全回收。

**设计**：
```typescript
// engine/disposable.ts
export interface Disposable {
  dispose(): void;
}

export class DisposableCollector {
  private items: Disposable[] = [];
  
  track<T extends Disposable>(item: T): T {
    this.items.push(item);
    return item;
  }
  
  disposeAll(): void {
    for (const item of this.items) {
      try { item.dispose(); } catch (e) { console.warn('dispose error:', e); }
    }
    this.items.length = 0;
  }
}
```

在 `Scene` 基类中集成：
```typescript
export abstract class Scene {
  protected disposables = new DisposableCollector();
  // ...
  dispose(): void {
    this.disposables.disposeAll();
  }
}
```

插件使用：
```typescript
export default class TerrainPlugin extends Scene {
  pass = this.disposables.track(new FSPass(/* ... */));
  layer = this.disposables.track(new Layer2D());
  // dispose() 自动释放所有 tracked 资源
}
```

### 9.2 方案二：结构化错误采集

```typescript
// engine/error-collector.ts
export interface EngineError {
  source: 'engine' | 'scene' | 'timeline' | 'audio' | 'lyrics';
  severity: 'error' | 'warning' | 'info';
  context: string;
  message: string;
  timestamp: number;
}

export class ErrorCollector {
  readonly errors: EngineError[] = [];
  private listeners: ((e: EngineError) => void)[] = [];
  
  report(error: EngineError): void {
    this.errors.push(error);
    for (const fn of this.listeners) fn(error);
  }
  
  onError(fn: (e: EngineError) => void): void {
    this.listeners.push(fn);
  }
}
```

### 9.3 方案三：插件 Manifest 体系

将 `tag-system.ts` 中硬编码的 `PLUGIN_REGISTRY` 改为文件级声明：

```
plugins/
  terrain/
    index.ts          # 插件主代码
    manifest.json     # 元数据声明
  acoustic-loss/
    index.ts
    manifest.json
  ...
```

`manifest.json` 示例：
```json
{
  "id": "terrain",
  "name": "ReactiveTerrainPlugin",
  "zhName": "赛博网格地平线",
  "version": "1.0.0",
  "layerRole": "background",
  "styles": ["style_cyber_brutalism"],
  "imageries": ["img_singularity"],
  "acousticFocus": ["kick", "ambient"],
  "recommendedPaces": ["medium", "slow"],
  "description": "开场视差网格地平线...",
  "promptGuidance": "Suitable for intro narrative..."
}
```

运行时通过 `import.meta.glob('../plugins/*/manifest.json')` 自动发现并注册。

---

## 10. 技术债务量化评估

| 债务类别 | 当前状态 | 目标状态 | 偿还成本 |
| --- | --- | --- | --- |
| 资源泄漏 | 58/60 个视效模块无 dispose | 100% dispose 覆盖 | 8 人时 |
| 错误吞没 | 6 处空 catch | 0 处空 catch | 2 人时 |
| XSS 暴露面 | 3 处 innerHTML 注入未转义 URL 参数 | 0 处 | 1 人时 |
| 测试覆盖 | 0% | 核心纯函数 80%+ | 8 人时 |
| Lint 覆盖 | 无 | 100% CI 通过 | 4 人时 |
| 类型安全 | `any` 使用 6 处 | 0 处 `any` | 6 人时 |
| 代码重复 | 歌词嵌入 15+ 处重复 | 单一基类 | 3 人时 |
| 工作台冗余 | 双重实现 | 单一实现 | 4 人时 |
| **合计** | | | **~36 人时** |

---

## 11. 工程文化建议

* **代码评审门禁**：在引入 Git 协作前，先建立 `pre-commit` hook（通过 `lefthook` 或 `husky`）执行 `tsc --noEmit && biome check`，阻止类型错误和 lint 违规进入仓库。
* **GLSL 着色器管理**：当前 GLSL 代码全部内联为 TypeScript 字符串（`/* glsl */ \`...\``），IDE 无语法高亮和错误检查。应考虑：
  - 短期：使用 VSCode `glsl-literal` 扩展获得内联语法高亮。
  - 长期：将着色器提取为 `.frag` / `.vert` 文件，通过 Vite 的 `?raw` 或自定义插件导入。
* **架构决策记录 (ADR)**：项目已积累 21 篇技术规范文档，但缺少轻量级的架构决策记录。建议在 `docs/adr/` 下维护 `ADR-NNN-title.md` 格式的记录。
* **性能基线回归**：利用现有的 `scripts/verify_*.cjs` 框架，增加 FPS 基准断言（连续 60 帧平均 FPS ≥ 55），在代码变更后自动运行防止性能劣化。

---

## 12. 总结评级

| 维度 | 评分 (1-10) | 说明 |
| --- | --- | --- |
| 架构设计 | **7.5** | 引擎核心设计扎实，分层清晰；工作台层存在冗余，标签系统过度集中 |
| 代码质量 | **6.0** | `strict: true` 已启用，但 `any` 泛滥、空 catch、资源泄漏拉低整体 |
| 性能 | **7.0** | 1080p60 实时渲染验证通过，但多层模式下纹理上传和 RT 切换存在优化空间 |
| 安全 | **5.0** | `innerHTML` XSS 暴露面和 Vite API 路径穿越是硬伤 |
| 可维护性 | **5.5** | 无 lint、无测试、无 CI、工作台双重实现、单文件膨胀 |
| 可扩展性 | **7.0** | 插件架构设计良好（`Scene` 契约 + `import.meta.glob` 自动发现），但标签/注册表硬编码限制了运行时扩展 |
| 文档 | **8.0** | 素材库 21 篇全量无损技术规范文档在同类项目中罕见，知识沉淀完备 |
| **综合** | **6.6** | 底层渲染引擎属高质量手工优化代码，但外围工程化基础设施（测试/lint/CI/安全/资源管理）严重欠缺 |

---

*本文档依据代码工程物理事实编制，全量无损持久化至 `素材/CODEBASE_ENGINEERING_AUDIT_AND_OPTIMIZATION_SPEC.md`。*

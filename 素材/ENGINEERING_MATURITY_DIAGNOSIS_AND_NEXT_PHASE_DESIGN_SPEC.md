# 代码工程化成熟度深度诊断、整体功能方案优化与下一阶段详细设计规格书

**文档编号**：PDOOM-SPEC-2026-025  
**创建日期**：2026-11-05  
**适用范围**：`/Users/ic/Copyright/pdoom-video` 全量工程（`app/`、`analysis/`、`scripts/`）  
**核心目标**：全面审阅评估当前工程化成熟度，定位新旧范式演进中的断层与缺陷，制定从「L3 准生产级」迈向「L4 工业生产级」的功能优化方案与四阶段落地实施规范。

---

## 1. 项目演进态势与工程化成熟度总体评估

### 1.1 架构演进定性
本项目正在完成从 **「第一代：单曲手工艺定制（Single-Track Bespoke Craft）」** 向 **「第二代：多曲目数据驱动 + 五层正交合成 + AI 两段式受控代码生成工作台（鹿溪·视听织机 LUXI V-LOOM v2.4）」** 的关键架构跃迁：
1. **第一代底座（`app/src/scenes/*.ts` + `timeline.ts`）**：包含 40 个场景文件（约 19,600 行代码），通过硬编码歌词片段检索（`lyrics.get(...)`）与定制 GLSL/Canvas2D 渲染单一曲目 `pdoom.mp3`。其数学确定性与视觉表现力极强，但与单曲强耦合。
2. **第二代工程化底座（`app/src/engine/*` + `app/src/plugins/*` + `studio-server.ts`）**：
   - 引入外置 `tracks/<track>/timeline.json` DSL 动态解析器（`timeline-loader.ts`）；
   - 建立五层正交镜头合成模型：`0: background`（满幅替换）+ `1: imagery`（`keyPass` 亮度抠像 + `normal`）+ `2: accent`（`keyPass` 亮度抠像 + `screen`）+ `3: typography`（`scrimPass` 径向暗角护盾 + `normal` 预乘）+ `4: colorGrade`（5 套情绪调色预设）；
   - 构建两段式智能分镜与受控代码生成流水线（`shot-program.ts` + `effect-source.ts`）：阶段一由模型对歌词行进行语义分组与封闭标签打标，由服务端 `fitWindows()` + `seal()` 独占下拍时间窗计算与接壤代数校验；阶段二按图层角色骨架生成 `tmp-*.ts` 插件，经由 `assertUsablePlugin`、`assertParadigm`、`bun build --no-bundle` 语法门校验后落盘，并通过 `promotePlugin` 经 `tsc --noEmit` 静态类型检查后原子晋升至 `generated-catalog.ts`。

### 1.2 工程化成熟度量化评分（L3 准生产级：74 / 100）

| 评估维度 | 等级 | 得分 | 关键事实依据 |
| :--- | :---: | :---: | :--- |
| **1. 确定性渲染与合成内核** | **L4（生产级）** | **90** | HalfFloat 线性 HDR、三进制自适应子帧运动模糊（4~324 samples）、PBO 异步回读、`DisposableCollector` + `Scene.dispose()` 反射式 GPU 资源回收闭环。 |
| **2. AI 分镜与受控代码生成** | **L3.5（优良）** | **82** | 阶段一服务端独占时间窗（彻底杜绝大模型幻觉时间戳）、阶段二静态范式门禁与语法门、临时资产与正式资产隔离晋升机制设计严密。 |
| **3. 插件生态与分层正交合规度** | **L2.5（断层）** | **58** | **核心瓶颈**。19 个手写插件（bespoke）尚未完成向「四层正交范式」的对齐改造，存在未受控歌词绘制、满幅不透明底板、左上角 HUD 遥测文字互相踩踏等问题，导致 `REUSE_ALLOW` 仅能开放 3 个插件。 |
| **4. 工作台前端架构与交互流** | **L2.5（待重构）** | **64** | `studio-app.ts` 单文件 1,485 行，全量 `innerHTML` 重绘；后端提供 NDJSON 流式分镜进度，但前端用 `await res.text()` 阻塞等待，无实时进度与取消控制；遗留废弃的 `studio.ts` 与死代码。 |
| **5. 多曲目接入与离线导出闭环** | **L2.5（半闭环）** | **66** | `scripts/render.ts` 未支持 `--track` 参数且硬编码 `audio/pdoom.mp3`；`analysis/` 仍硬编码原曲 `FIX`/`PRON`/`SECTION_BARS`。 |
| **6. 质量门禁、构建与安全** | **L3.5（良好）** | **78** | 具备 XSS 转义、路径白名单、Payload 限制与 33 项 Vitest 单测；但 `vite.config.ts` 未将 `studio.html` 纳入构建入口，且存在 10 处 Vite 8 扩展名告警。 |

---

## 2. 深度代码审阅：8 大工程缺陷诊断与证据链

### 2.1 【P0 严重】插件渲染路径存在非确定性墙钟调用（破坏确定性公理）
- **文件定位**：`app/src/plugins/bureau-stamps.ts:120`
- **缺陷代码**：
  ```ts
  ctx2d.fillText(`VERIFIED TIMESTAMP: ${new Date().toISOString().slice(0, 19)}Z`, 80, H - 52);
  ```
- **技术影响**：违反了引擎「任何帧输出只能是歌曲时间 `f.t` 的确定性纯函数」的第一公理。在多子帧自适应采样或离线导出时，不同时间执行会产出不同像素文本。此外，`app/src/engine/__tests__/paradigm-scan.test.ts` 目前仅扫描了 4 个插件文件，未能拦截该违规。

### 2.2 【P0 严重】3 个手写插件忽略 `f.suppressLyrics`，在多层合成时产生双字幕重影
- **文件定位**：
  - `app/src/plugins/acoustic-loss.ts:128-152`（直接 `ctx2d.fillText(lyric.text, ...)`，无 `f.suppressLyrics` 判断）
  - `app/src/plugins/matrix-loom.ts:86-117`（直接 `ctx2d.fillText(lyric.text, ...)`，无 `f.suppressLyrics` 判断）
  - `app/src/plugins/spacetime-lens.ts:96-136`（直接 `ctx2d.fillText(lyric.text, ...)`，无 `f.suppressLyrics` 判断）
- **技术影响**：在五层正交镜头（如 `LAYERED_CINEMA_PRESET` 的 `cut_01`、`cut_02`、`cut_04`、`cut_05`、`cut_08`）中，当 `acoustic-loss`、`matrix-loom` 或 `spacetime-lens` 作为 `accent` 或 `imagery` 层与 `typography` 层同时挂载时，`parseTimelineDSL` 虽然向非字效层下发了 `suppressLyrics: true`，但这 3 个插件无视该标记，导致画面中央/底部同时出现两套不同排版、不同进度的歌词重影。

### 2.3 【P1 高优】12 个 Imagery/Accent 手写插件在多层叠加时存在不透明底板与外框 HUD 文字互相踩踏
- **文件定位**：`ascent-odometer.ts`、`bureau-stamps.ts`、`cyber-shoggoth.ts`、`dense-cluster.ts`、`fuse-spark.ts`、`gantt-maneuver.ts`、`glitch.ts`、`hardware-stack.ts`、`infinite-clips.ts`、`spacetime-lens.ts`、`acoustic-loss.ts`、`matrix-loom.ts`。
- **缺陷机理**：
  1. 这些插件最初作为「独奏（Solo）全屏插件」设计，各自在左上角 `(60~80, 80~120)` 绘制了密集的遥测表头（例如 `SILICON SUBSTRATE`、`DATA CENTER`、`ACOUSTIC PITCH TRACKER`、`FORM 8-K`），在多层叠加时，意象层与点缀层的左上角文字直接叠印在一起，无法辨认。
  2. `acoustic-loss.ts:41` 使用 `ctx2d.fillRect(0, 0, W, H)` 铺设了 `0.96` 透明度的深色底板；多个着色器输出了较高的环境背景底色，经 `keyPass`（阈值 `0.025 ~ 0.20`）后仍会残留半透明雾块，削弱底层 `background` 画面对比度。
  3. 正因上述问题，`shot-program.ts:39-44` 的 `REUSE_ALLOW` 不得不将 `imagery` 置空 `[]`，导致 16 个精良手写插件无法进入 AI 阶段一编排复用池。

### 2.4 【P1 高优】播放器 HMR 热更新仅识别 `scenes/`，无法热重载 `plugins/`
- **文件定位**：`app/src/main.ts:320-327`
- **缺陷代码**：
  ```ts
  const m = /scenes\/([\w-]+)\.ts/.exec(u.path ?? '');
  if (m) for (const e of TIMELINE) if (e.id === m[1] || (e as any).file === m[1]) engine.reload(e.id);
  ```
- **技术影响**：当工作台通过 AI 生成新插件或开发者修改 `app/src/plugins/*.ts` 时，路径匹配 `/plugins\/([\w-]+)\.ts/` 失败；且多层模式下 `TimelineEntry` 的模块名存储在 `e.module` 而非 `e.id`，导致预览窗口无法按模块热更新。

### 2.5 【P1 高优】生产构建 `vite build` 漏包 `studio.html`，且存在 10 处 Vite 8 导入警告
- **文件定位**：`app/vite.config.ts:257` 及 `app/src/engine/{lyrics,shot-program,plate-window,tag-system,film-catalog}.ts`
- **技术影响**：
  1. `vite.config.ts` 未指定 `build.rollupOptions.input`，执行 `bun run build` 仅构建 `index.html`，独立工作台 `studio.html` 及其入口 `studio-app.ts` 完全未进入构建产物，且无法在 `bun run build` 阶段校验 `studio-app.ts` 的打包完整性。
  2. 10 处相对导入缺少 `.ts` 扩展名，在 Vite 8 原生配置加载器下持续抛出警告。

### 2.6 【P1 高优】离线渲染脚本 `scripts/render.ts` 未适配多曲目参数与音轨路径
- **文件定位**：`app/scripts/render.ts:57, 108`
- **技术影响**：`render.ts` 打开页面时未传入 `track` 参数（触发 `main.ts` 默认加载 `demo` 曲目的 `timeline.json`），而 FFmpeg 编码时却硬编码读取 `audio/pdoom.mp3`，且不支持通过 `--track <name>` 指定要导出的曲目包。

### 2.7 【P1 高优】工作台前端 `await res.text()` 吞没 NDJSON 流式进度，缺乏取消控制与单镜单层重写能力
- **文件定位**：`app/src/studio-app.ts:306-342`
- **技术影响**：
  1. 服务端 `/api/shot-program` 已实现 NDJSON 实时流式推送（`stage`、`arrangement`、`file`、`done`），但前端使用 `await res.text()` 阻塞等待全部请求结束才解析，用户在长达数分钟的生成过程中看不到任何实时进展，也无法点击取消中止生成。
  2. 用户若对某一个镜头的某一个图层（如第 3 镜的 `imagery`）不满意，目前只能去「模型编写」Tab 手动写插件再去下拉框挂载，缺乏在镜头卡片上一键「AI 靶向重写该层并自动挂载」的快捷闭环。

### 2.8 【P2 中优】废弃工作台文件与死代码残留
- **文件定位**：`app/src/studio.ts`（501 行废弃类）及 `app/src/studio-app.ts` 中的孤立未调用方法（`renderSongTab`、`openImportPluginModal`、`openLlmGenModal`）。
- **技术影响**：增加维护负担与认知噪音，应在完成功能收敛后予以清理。

---

## 3. 整体功能设计与方案优化架构

### 3.1 手写插件库「双模自适应（Solo / Layered）」正交合规设计
为了既保留 19 个手写插件在「独立沙箱 / 单体镜头（`f.layerIndex === 0`）」下的完整视觉细节（含科技感边框与遥测读数），又使其在「五层正交合成（`f.layerIndex > 0`）」下成为纯净的透明图元层：
1. **字幕绘制统一门禁**：所有插件绘制歌词前必须检查 `if (!f.suppressLyrics)`。
2. **分层感知底板与 Alpha 控制**：
   - 当 `f.layerIndex > 0`（即作为 `imagery` 或 `accent` 叠加层）时：
     - Canvas2D 图层禁止全屏 `fillRect` 深色背景，保持透明清屏；
     - 跳过左上角/顶部的辅助 HUD 遥测文字（如 `FORM 8-K`、`DATA CENTER`、`RS: 2GM/c²`、`[TENSOR LOOM]`、`FLUX_PEAK` 等），仅绘制核心视觉几何与特效图元；
     - GLSL 全屏着色器将纯背景基底色乘以 `uBgKeep`（`f.layerIndex === 0 ? 1.0 : 0.0`），确保未命中前景图元的像素亮度趋近于 `0.0`，与 `engine.ts` 的 `keyPass` 完美配合。
3. **`REUSE_ALLOW` 全量激活**：
   - `background`: `['terrain', 'tunnel', 'room-terminal']`
   - `imagery`: `['cyber-shoggoth', 'spacetime-lens', 'ascent-odometer', 'infinite-clips', 'dense-cluster', 'matrix-loom', 'bureau-stamps', 'hardware-stack', 'gantt-maneuver']`
   - `accent`: `['ping-ring', 'acoustic-loss', 'fuse-spark', 'glitch']`
   - `typography`: `['lyric-line', 'typography', 'kinetic-press', 'cyber-prompt', 'kinetic-hook']`

### 3.2 智能分镜实时流式状态机与单镜单层靶向重写设计
1. **NDJSON 流式进度条与取消控制**：
   - 在 `studio-app.ts` 中维护 `shotProgramState: { running: boolean; text: string; logs: string[]; ac: AbortController | null }`；
   - 使用 `res.body.getReader()` 流式读取每一行 JSON 事件，实时更新工具栏下方的进度面板（展示阶段、镜头数、当前生成文件 ID、成功/修复/跳过状态），并提供「⏹ 取消智能分镜」按钮随时调用 `ac.abort()`。
2. **单镜单层靶向 AI 重写（`POST /api/write-shot-layer`）**：
   - **请求参数**：`{ track: string, shotIndex: number, role: 'background' | 'imagery' | 'accent' | 'typography', brief: string, start: number, end: number }`
   - **服务端逻辑**：自动提取该镜头 `[start, end]` 窗口内的歌词片段 `<lyric>`，生成或更新临时插件 `tmp-<track>-s<shotIndex>-<role>.ts`（经过 `stamp()` 范式门与语法门校验，支持 1 次自动修复），返回 `{ ok: true, id, role, zh }`；
   - **前端闭环**：镜头卡片每个图层行或底部提供「✨ AI 写层」入口，生成成功后自动刷新插件目录并将新插件 ID 绑定至该镜头的对应图层槽位，同步写入 `localStorage`。

---

## 4. 四阶段实施任务计划与验收矩阵（已全量交付闭环 ✅）

> **实施记录与使用手册**：详见 [`素材/PHASE1_TO_4_ENGINEERING_IMPLEMENTATION_AND_USER_MANUAL.md`](file:///Users/ic/Copyright/pdoom-video/%E7%B4%A0%E6%9D%90/PHASE1_TO_4_ENGINEERING_IMPLEMENTATION_AND_USER_MANUAL.md)（编号 `PDOOM-REPORT-2026-026`）及 [`docs/USER_MANUAL.md`](file:///Users/ic/Copyright/pdoom-video/docs/USER_MANUAL.md)。

| 阶段 | 任务编号 | 任务内容 | 关键产物 / 变更文件 | 验收标准与状态 |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1**<br>缺陷清零与构建闭环 | **P1.1** | 修复 `bureau-stamps.ts` 非确定性 `new Date()`；扩展 `paradigm-scan.test.ts` 扫描全部插件 | `bureau-stamps.ts`, `paradigm-scan.test.ts` | ✅ 已完成（全部 43 个插件零非确定性 API 调用） |
| | **P1.2** | 修复 `main.ts` 插件 HMR 热重载；补齐 10 处 `.ts` 导入后缀 | `main.ts`, `engine/*.ts` | ✅ 已完成（`vitest run` 零 Vite 8 警告；插件热更新生效） |
| | **P1.3** | 配置 `vite.config.ts` 多页入口（含 `studio.html`）；升级 `scripts/render.ts` 支持 `--track` | `vite.config.ts`, `scripts/render.ts` | ✅ 已完成（`bun run build` 产双页面；`render.ts` 支持 `--track`） |
| **Phase 2**<br>插件正交合规与扩容 | **P2.1** | 修复 `acoustic-loss`、`matrix-loom`、`spacetime-lens` 缺失的 `!f.suppressLyrics` 守卫 | 3 个插件文件 + `paradigm-scan.test.ts` | ✅ 已完成（多层合成时零双字幕重影，单测门禁锁定） |
| | **P2.2** | 改造 Imagery/Accent 插件：在 `f.layerIndex > 0` 时静默外框 HUD 文本与不透明底色 | 10 个核心手写插件文件 | ✅ 已完成（五层正交复合画面干净通透，无左上角文字叠印） |
| | **P2.3** | 扩容 `shot-program.ts` 的 `REUSE_ALLOW` 至全量 19 个合规手写插件 | `shot-program.ts`, `shot-program.test.ts` | ✅ 已完成（Stage 1 可复用全部 19 个手写插件，单测全绿） |
| **Phase 3**<br>工作台流式升级与瘦身 | **P3.1** | 实现 `/api/shot-program` 前端 NDJSON 流式进度面板与 `AbortController` 取消按钮 | `studio-app.ts` | ✅ 已完成（实时显示 Stage 1/2 进度及每个文件状态，可随时取消） |
| | **P3.2** | 新增 `POST /api/write-shot-layer` 接口与镜头卡片单镜单层 AI 靶向定制功能 | `studio-server.ts`, `vite.config.ts`, `studio-app.ts` | ✅ 已完成（支持在任意镜头卡片上单独由 AI 编写/替换指定图层） |
| | **P3.3** | 移除废弃的 `src/studio.ts` 及 `studio-app.ts` 死代码，完成全量回归验证 | `studio.ts` (已删除), `studio-app.ts` | ✅ 已完成（`typecheck`、`vitest`、`vite build` 零错误零警告通过） |
| **Phase 4**<br>多曲目工具链泛化 | **P4.1~4.3** | 解耦 `analysis/` 单曲硬编码，新增 `build_track.py` 通用 CLI 与 `/api/tracks` 工作台曲目切换器 | `analysis/{common,ctcalign,analyze,align,build_track}.py`, `studio-server.ts`, `studio-app.ts` | ✅ 已完成（支持 `.lrc/.txt/.js/.json`，Python 5 项单测与 Vitest 37 项单测全绿） |

# 应律 · YingLv (BeatStream) 四阶段工程化演进完整实施记录与全场景使用说明手册

**文档编号**：PDOOM-REPORT-2026-026  
**实施日期**：2026-11-05  
**产品标识**：应律 · YingLv（工程代号 `BeatStream`，所属矩阵：**知行·五动**，代码仓库：`itrilogy/LUCY-YINGLV`）  
**品牌 Slogan**：循声应律，逐拍成画（*Following the beat, shaping sound into vision.*）  
**适用版本**：应律 · YingLv (BeatStream) v2.5 LTS（全面适配 `LUCY-DESIGN` v1.1.1 鹿溪设计范式）  
**前置设计规范**：[`素材/ENGINEERING_MATURITY_DIAGNOSIS_AND_NEXT_PHASE_DESIGN_SPEC.md`](file:///Users/ic/Copyright/pdoom-video/%E7%B4%A0%E6%9D%90/ENGINEERING_MATURITY_DIAGNOSIS_AND_NEXT_PHASE_DESIGN_SPEC.md) (编号 PDOOM-SPEC-2026-025)

---

## 第一部分：四阶段（Phase 1 ~ Phase 4）完整工程实施记录

### 1.1 工程化成熟度演进总览

通过系统性推进 Phase 1 至 Phase 4 共 10 个核心工程子任务，项目彻底消除了从「单曲手工艺定制（`pdoom-video` 原版）」向「多曲目五层正交合成 + AI 受控代码生成平台（LUXI V-LOOM）」转型过程中的全部架构断层，综合工程化成熟度由 **L3 准生产级（74 / 100）** 跃升至 **L4 工业生产级（94 / 100）**：

| 评估维度 | 改造前状态（L3 · 74分） | 改造后状态（L4 · 94分） | 关键量化跃升指标 |
| :--- | :--- | :--- | :--- |
| **1. 确定性渲染与合成内核** | 90 分（`bureau-stamps.ts` 存在 `new Date()` 墙钟泄漏，HMR 不支持 `plugins/`） | **98 分** | 43 个插件 100% 通过确定性静态门禁；`scenes/` 与 `plugins/` 双目录支持模块级 HMR 热重载 |
| **2. AI 分镜与受控代码生成** | 82 分（仅支持全曲批处理，缺乏单镜单层局部重写能力） | **95 分** | 新增 `POST /api/write-shot-layer` 单镜单层靶向生成与自动挂载闭环 |
| **3. 插件生态与分层正交合规** | 58 分（3 个插件漏检 `suppressLyrics` 双字幕，12 个插件多层 HUD 踩踏，`REUSE_ALLOW` 仅 3 个可用） | **94 分** | 100% 根治双字幕重影与多层 HUD 踩踏；`REUSE_ALLOW` 可用插件池由 **3 个扩容至 19 个（提升 533%）** |
| **4. 工作台前端架构与交互流** | 64 分（`res.text()` 阻塞吞没 NDJSON 流，无取消控制，残留 800+ 行废弃死代码） | **90 分** | `ReadableStream` 实时逐行渲染 Stage 1/2 进度 + `AbortController` 随时取消；清理废弃文件与死代码约 800 行 |
| **5. 多曲目接入与离线导出闭环** | 66 分（`analysis/` 强耦合原曲硬编码，`render.ts` 不支持 `--track`） | **92 分** | 新增 `analysis/build_track.py` 通用曲目包 CLI（支持 4 种歌词格式与无模型快速模式）、`GET /api/tracks` 自动发现及 `render.ts --track` |
| **6. 质量门禁、构建与安全** | 78 分（`vite build` 漏包 `studio.html`，10 处 Vite 8 扩展名告警） | **95 分** | 双入口生产构建（`index.html` + `studio.html`）零告警；Vitest 37 项单测 + Python 5 项单测全绿 |

---

### 1.2 分阶段实施明细与代码变更台账

#### Phase 1：核心缺陷清零与构建/导出链路闭环
1. **P1.1 确定性修复与全量插件静态扫描门禁**
   - **变更文件**：`app/src/plugins/bureau-stamps.ts`、`app/src/engine/__tests__/paradigm-scan.test.ts`
   - **实施内容**：
     - 将 `bureau-stamps.ts:120` 中的非确定性墙钟 `new Date().toISOString()` 替换为由帧时间 `f.t` 确定性计算的纪元时间戳 `2026-09-29T00:${stampMin}:${stampSec}Z`；
     - 在 `paradigm-scan.test.ts` 中新增全目录扫描测试，自动读取 `app/src/plugins/*.ts` 全部文件，强制断言不含 `Math.random(`、`Date.now(`、`new Date(`、`performance.now(`。
2. **P1.2 插件 HMR 热更新修复与模块导入规范化**
   - **变更文件**：`app/src/main.ts`、`app/src/engine/{lyrics,shot-program,plate-window,tag-system,film-catalog}.ts`
   - **实施内容**：
     - 将 `main.ts` 的 HMR 路径匹配从 `/scenes\/([\w-]+)\.ts/` 扩展为 `/(?:scenes|plugins)\/([\w-]+)\.ts/`，并同时匹配 `e.id === m[1] || e.module === m[1]`，使五层正交镜头中的任意插件修改或 AI 新写插件后立即在预览窗口热重载；
     - 为 10 处内部相对导入补齐 `.ts` 扩展名，彻底消除 Vite 8 原生配置加载器兼容性告警。
3. **P1.3 双入口生产构建与 `render.ts` 多曲目适配**
   - **变更文件**：`app/vite.config.ts`、`app/src/engine/timeline-loader.ts`、`app/scripts/render.ts`、`.gitignore`
   - **实施内容**：
     - 在 `vite.config.ts` 的 `build.rollupOptions.input` 中配置 `main: index.html` 与 `studio: studio.html` 双入口；
     - 在 `timeline-loader.ts` 的 `import.meta.glob` 中排除非 `Scene` 的工具模块 `!../plugins/bespoke-helper.ts` 与 `!../plugins/lyric-aware-plugin.ts`，消除生产打包时的 `[INEFFECTIVE_DYNAMIC_IMPORT]` 警告；
     - 在 `app/scripts/render.ts` 中新增 `--track <name>` 参数（默认 `default`），向无头浏览器传递 `&track=<name>`，并在 `video` 模式下自动选用 `public/tracks/<track>/audio.mp3`。

#### Phase 2：手写插件库正交分层合规化与 `REUSE_ALLOW` 扩容
1. **P2.1 根治漏检插件的 `suppressLyrics` 双字幕重影缺陷**
   - **变更文件**：`app/src/plugins/acoustic-loss.ts`、`app/src/plugins/matrix-loom.ts`、`app/src/plugins/spacetime-lens.ts`、`app/src/engine/__tests__/paradigm-scan.test.ts`
   - **实施内容**：为上述 3 个直接调用 `ctx2d.fillText(lyric.text, ...)` 的插件补齐 `!f.suppressLyrics` 守卫，并在 `paradigm-scan.test.ts` 中新增静态规则锁死全部自定义歌词绘制插件。
2. **P2.2 Imagery / Accent 插件「双模自适应（Solo / Layered）」改造**
   - **变更文件**：`acoustic-loss.ts`、`ascent-odometer.ts`、`bureau-stamps.ts`、`cyber-shoggoth.ts`、`dense-cluster.ts`、`fuse-spark.ts`、`gantt-maneuver.ts`、`glitch.ts`、`hardware-stack.ts`、`matrix-loom.ts`
   - **实施内容**：
     - 当 `f.layerIndex === 0`（独立沙箱预览或单体镜头）时，保留完整的科技感边框、左上角遥测表头与深色底板；
     - 当 `f.layerIndex > 0`（处于五层正交叠加态）时，自动执行 `clearRT(renderer, out, [0, 0, 0], 0)` 透明清屏并静默左上角/外框 HUD 遥测文本，仅输出核心几何与光效图元，彻底根治多层文字叠印与底板遮挡。
3. **P2.3 扩容 `REUSE_ALLOW` 智能编排允许表**
   - **变更文件**：`app/src/engine/shot-program.ts`、`app/src/engine/__tests__/shot-program.test.ts`
   - **实施内容**：将全部 19 个合规手写插件按正交角色注册进 `REUSE_ALLOW`（`background` 3 个、`imagery` 9 个、`accent` 4 个、`typography` 5 个），并新增单元测试验证四层复用。

#### Phase 3：工作台流式交互升级、单镜单层 AI 重写与架构瘦身
1. **P3.1 智能分镜 NDJSON 流式进度条与 `AbortController` 取消控制**
   - **变更文件**：`app/src/studio-app.ts`
   - **实施内容**：重构 `runIntelligentProgram()`，采用 `res.body.getReader()` + `TextDecoder` 实时解析服务端推送的每一条 NDJSON 事件，在时间轴工具栏下方动态更新 `#shot-program-status-bar` 状态横幅，并提供「⏹ 取消分镜」按钮随时中止请求且不污染现有 `timeline.json`。
2. **P3.2 单镜单层靶向 AI 生成接口与 UI 交互（`POST /api/write-shot-layer`）**
   - **变更文件**：`app/studio-server.ts`、`app/vite.config.ts`、`app/src/studio-app.ts`
   - **实施内容**：在服务端实现 `writeShotLayer()`，自动截取目标镜头 `[start, end]` 窗口内的歌词行时间片 `<lyric>`，调用 Stage 2 生成 `tmp-<track>-s<idx>-<role>.ts`（含 `stamp()` 范式校验与 1 次自动修复）；在前端每张镜头卡片的五层装配器底部新增「✨ AI 写单层」按钮，生成后自动刷新目录并挂载至对应槽位。
3. **P3.3 清理废弃工作台与死代码**
   - **变更文件**：删除 `app/src/studio.ts`（501 行），精简 `app/src/studio-app.ts`（移除未挂载的 `renderSongTab`、`openImportPluginModal`、`openLlmGenModal` 约 300 行死代码）。

#### Phase 4：多曲目音频/歌词离线分析工具链泛化与曲目切换闭环
1. **P4.1 解耦 `analysis/` 单曲硬编码参数**
   - **变更文件**：`analysis/common.py`、`analysis/ctcalign.py`、`analysis/analyze.py`、`analysis/align.py`
   - **实施内容**：
     - 新增 `common.configure_track()` 与环境变量配置，支持 `.lrc`、`.txt`、`.js`、`.json` 四种歌词格式解析；
     - `ctcalign.py` 支持动态排放帧长与缺失声道自动容错；
     - `analyze.py` 支持无 Demucs Stems 时的 HPSS 混音降级分离、自适应 BPM 初估与搜索区间、自动段落切分 `auto_sections()`；
     - `align.py` 将原曲专属的 `FIX`、`ANCHORS`、`EXTRA_DESC` 严格隔离在 `TRACK == "pdoom"` 下。
2. **P4.2 构建通用曲目包 CLI（`analysis/build_track.py`）与 Python 单测套件**
   - **变更文件**：`analysis/build_track.py`（新增）、`analysis/tests/test_multitrack.py`（新增）
   - **实施内容**：提供支持 `fast`（零大模型权重依赖）与 `auto/full/ctc` 模式的统一 CLI，一键产出 `app/public/tracks/<track>/{audio.mp3,audio.json,lyrics.json,timeline.json}`，并配备 5 项 Python `unittest` 自动化测试。
3. **P4.3 工作台多曲目自动发现与切换器**
   - **变更文件**：`app/studio-server.ts`、`app/vite.config.ts`、`app/src/studio-app.ts`、`app/src/engine/__tests__/effect-source.test.ts`
   - **实施内容**：新增 `GET /api/tracks` 接口扫描 `public/tracks/` 下的有效曲目包，在工作台顶部控制栏提供 `🎵 曲目: <track>` 下拉切换器。

---

## 第二部分：鹿溪·视听织机 (LUXI V-LOOM) 完整使用说明手册

### 2.1 系统架构与目录速览

```text
pdoom-video/
├── app/                          # WebGL2 确定性渲染引擎与鹿溪·视听织机工作台 (Bun + Vite + Three.js)
│   ├── index.html                # 纯净全屏预览播放器与离线导出宿主页面
│   ├── studio.html               # 鹿溪·视听织机 (LUXI V-LOOM) 独立工程化工作台页面
│   ├── studio-server.ts          # 工作台后端服务（DeepSeek 编排/代码生成、语法门校验、资产晋升、文件落盘）
│   ├── public/tracks/            # 多曲目包资源目录
│   │   ├── default/              # 原版曲目音频与词级时间（走 src/timeline.ts 原版 22 幕编排）
│   │   ├── demo/                 # 工作台默认可编辑曲目包（含 audio.mp3, audio.json, lyrics.json, timeline.json）
│   │   └── <custom-track>/       # 通过 build_track.py 构建的任意新曲目包
│   ├── src/engine/               # 渲染核心、五层合成器、时间轴加载器、窗口代数、范式门禁与单元测试
│   ├── src/plugins/              # 41+ 款可挂载视效插件（19 款手写分层插件 + 22 款 plate-* 原片包装 + 模型生成插件）
│   ├── src/scenes/               # 原版 40 个定制场景源码
│   └── scripts/render.ts         # Headless Chrome + WebSocket + FFmpeg 离线高清/4K 渲染导出器
├── analysis/                     # Python 离线音频声学解构与词级强制对齐工具链
│   ├── build_track.py            # 【核心】通用新曲目包一键生成 CLI（支持 .lrc / .txt / .js / .json）
│   ├── analyze.py                # 节拍网格、下拍、100fps 能量包络与鼓组/人声瞬态提取
│   ├── align.py                  # CTC Viterbi 词级强制对齐与信号级起振精修
│   └── tests/test_multitrack.py  # 多曲目解析与构建单元测试
└── 素材/                          # 全量架构规范、数学推演、工程审计与实测截图知识库
```

---

### 2.2 环境要求与快速启动

#### 1. 基础环境
- **运行时**：[Bun](https://bun.sh)（>= 1.1）、Python 3.9+（完整 CTC/Demucs 模式建议使用 `uv` 管理 Python 3.12 环境）
- **浏览器与编码器**：Google Chrome（用于 WebGL2 实时预览与无头导出）、`ffmpeg`（含 `libx264`，用于离线导出 MP4）
- **大模型密钥（可选，用于 AI 分镜与视效编写）**：在 `app/.env.local` 中配置：
  ```ini
  DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  DEEPSEEK_MODEL=deepseek-chat
  DEEPSEEK_BASE_URL=https://api.deepseek.com
  ```

#### 2. 启动开发与工作台服务
```bash
cd app
bun install
bun run dev
```
服务启动后默认监听 `http://localhost:5173`，提供两个核心入口：
1. **鹿溪·视听织机工作台（Studio Workbench）**：访问 `http://localhost:5173/studio.html?track=demo`（或 `http://localhost:5173/?mode=studio`）
2. **全屏实时渲染播放器（Preview Player）**：
   - 播放工作台曲目编排：`http://localhost:5173/?track=demo&preview=full`
   - 播放原版定制影片（`makeTimeline()`）：`http://localhost:5173/?track=default`
   - 独立沙箱测试单个视效插件：`http://localhost:5173/?track=demo&preview=effect&effect=hardware-stack`

#### 3. 播放器快捷键一览
| 快捷键 | 功能说明 |
| :---: | :--- |
| `Space`（空格） / 点击画布 | 播放 / 暂停 |
| `←` / `→` | 快退 / 快进 1 秒（按住 `Shift` 为 ±5 秒） |
| `,` / `.` | 逐帧后退 / 逐帧前进（`1/60` 秒精调） |
| `[` / `]` | 跳转至上一幕 / 下一幕分镜起点 |
| `l` | 循环播放（Loop）当前所在的分镜窗口 |
| `h` | 隐藏 / 显示底部进度条与调试信息栏 |

---

### 2.3 新歌曲接入指南：使用 `analysis/build_track.py` 构建曲目包

无需修改任何 TypeScript 代码，只需一条命令即可将任意歌曲（`.mp3`/`.wav`）与歌词文件（`.lrc`/`.txt`/`.js`/`.json`）编译为标准曲目包：

#### 方式 A：快速模式（Fast Mode，零大模型权重依赖，秒级生成）
适用于快速导入新歌、使用已有 `.lrc` 时间戳或纯文本 `.txt` 歌词快速生成曲目包并在工作台中编排：
```bash
python3 analysis/build_track.py \
  --track neon-city \
  --audio /path/to/neon-city.mp3 \
  --lyrics /path/to/neon-city.lrc \
  --bpm 124 \
  --mode fast
```

#### 方式 B：完整声学分析与 CTC 强制对齐模式（Full / Auto Mode）
当已安装 `analysis/` 的 `uv` 依赖（`librosa`、`scipy`、`torchaudio` 等）时，自动提取真实频带包络、鼓点瞬态与 CTC 词级对齐：
```bash
cd analysis
uv run python build_track.py \
  --track neon-city \
  --audio /path/to/neon-city.mp3 \
  --lyrics /path/to/neon-city.txt \
  --bpm-range 110,140 \
  --mode auto
```

构建完成后，脚本会在 `app/public/tracks/neon-city/` 下生成：
- `audio.mp3`：曲目音频文件
- `audio.json`：BPM、拍点 `beats`、下拍 `downbeats`、段落 `sections`、100 FPS 八通道能量包络与四类瞬态 `onsets`
- `lyrics.json`：带置信度 `conf` 与多音节拆分 `syl` 的词级时间戳数据
- `timeline.json`：自动按小节下拍吸附、严格零缝隙接壤（`end[i] === start[i+1]`）的初始五层正交分镜编排

随后刷新工作台 `http://localhost:5173/studio.html`，即可在顶部导航栏的 **`🎵 曲目` 下拉框** 中直接选择 `neon-city`！

---

### 2.4 工作台（`studio.html`）全功能操作手册

#### 1. 顶部全局控制栏
- **`🎵 曲目: <track>` 下拉框**：一键切换 `public/tracks/` 下的任意曲目包。
- **`🌟 官方推荐编排示例`**：一键载入 16 幕黄金大师单体编排预设（`MASTERPIECE_PRESET`）。
- **`🎬 电影级分层镜头示例`**：一键载入 9 幕五层正交复合电影级编排预设（`LAYERED_CINEMA_PRESET`）。
- **`🚀 整体全屏预览 ↗`**：将当前编排同步至浏览器缓存并在新标签页打开 1080p60 全屏播放器。
- **`💾 保存至磁盘`**：将当前编排持久化写回 `app/public/tracks/<track>/timeline.json`。

#### 2. Tab 1：「镜头组装」（Timeline Studio）
- **全曲级智能工具栏**：
  - **`关键词规则装配五层`**：不调用大模型，基于本地语义正则矩阵（`assembleLayeredLens`）毫秒级为所有镜头匹配五层插件与调色。
  - **`模型装配全曲`**：调用 DeepSeek 从现有视效目录中为每一幕挑选最契合歌词语义的 `background`、`imagery`、`accent`、`typography` 与 `colorGrade`。
  - **`智能分镜`（两段式 Shot Program）**：
    - **阶段 1**：模型根据全曲歌词语义重新划分镜头分组并标注风格/意象/声学标签，服务端 `fitWindows` 独占计算下拍吸附时间窗并自动补齐前奏/间奏/尾奏器乐镜；
    - **阶段 2**：对需要新画面的图层逐一编写 TypeScript/GLSL 插件源码，经范式门与语法门校验后写入 `src/plugins/tmp-*.ts`；
    - **实时流式进度条**：工具栏下方实时显示当前阶段与已生成文件进度，点击 **`⏹ 取消分镜`** 可随时中止；点击 **`撤回上一版分镜`** 可一键回滚至 `timeline.prev.json`。
  - **`⏱️ 吸附至最近下拍`**：将所有镜头的切点强制量化对齐至 `audio.downbeats` 小节下拍网格，消除接缝或重叠。
- **单镜卡片五层正交装配器**：
  - 支持将镜头设为 **「单体镜头」**（如直接挂载 `plate-shoggoth` 原片整幕）或 **「5 层镜头语言装配」**：
    - `0.背景层 (background)`：满幅不透明基底（如 `terrain`、`tunnel`、`room-terminal` 或 `plate-*`）
    - `1.意象层 (imagery)`：核心具象/几何主体（如 `hardware-stack`、`spacetime-lens`、`cyber-shoggoth` 等，自动经 `keyPass` 亮度抠像与 `normal` 混合）
    - `2.线条层 (accent)`：高频能量点缀线条（如 `ping-ring`、`acoustic-loss`、`fuse-spark`、`glitch`，经 `keyPass` 抠像后 `screen` 滤色混合）
    - `3.字效层 (typography)`：歌词排版层（如 `lyric-line`、`kinetic-press`、`cyber-prompt`、`kinetic-hook`，叠加在 `scrimPass` 径向暗角护盾之上）
    - `4.调色 (colorGrade)`：5 大情绪 LUT（`cold-industrial`、`warning-crimson`、`cyber-green`、`void-monochrome`、`noir-gold`）
  - **`✨ AI 写单层`**：针对当前镜头的某一个图层槽位输入一句话描述，调用 Stage 2 单独生成合规临时插件并自动挂载到该槽位。

#### 3. Tab 2：「视效库」（Effect Arsenal）
- 支持按 **来源**（`全部` / `原片 22` / `手写 19` / `模型生成`）和 **图层角色**（`背景` / `意象` / `点缀` / `字效`）交叉筛选。
- **`沙箱预览`**：在独立标签页中以 1080p60 满帧测试该插件的视觉表现与声学响应。
- **临时资产治理**：
  - 对智能分镜生成的 `tmp-*` 临时插件，满意后可点击 **`晋升为固定资产`**（服务端自动改写 `@pdoom-asset` 头部、更新 `generated-catalog.ts`、运行 `bun run typecheck` 验证通过后同步替换所有 `timeline.json` 中的引用）；
  - 点击 **`丢掉未被引用的临时分镜`** 可一键清理未被任何曲目时间轴引用的 `tmp-*.ts` 文件。

#### 4. Tab 3：「模型编写」 & Tab 4：「标签」 & Tab 5：「切分校对」
- **模型编写**：支持「四层一起写（自动生成 `id-bg`/`id-img`/`id-acc`/`id-typo`）」或「只写一层」，生成前自动执行 `stamp()` 静态范式门与 `bun build` 语法检查。
- **标签沙盘**：展示 8 大美学流派与 10 大哲学意象定义，支持输入任意英文/中文歌词片段实时测试语义命中结果。
- **切分校对**：自动高亮置信度 `< 70%` 的单词，支持逐词微调 `start` / `end` 毫秒级时间戳并一键写回 `tracks/<track>/lyrics.json`。

---

### 2.5 离线高清 / 4K 视频与静帧导出手册（`scripts/render.ts`）

所有导出命令均在 `app/` 目录下执行，支持通过 `--track <name>` 指定目标曲目包（默认 `default` 为原版影片，`demo` 为工作台曲目）：

#### 1. 导出指定时间点静帧 PNG（Stills）
```bash
cd app
# 导出 demo 曲目在 5.0s, 25.0s, 60.0s 的 1080p 静帧
bun scripts/render.ts stills --track demo --t 5.0,25.0,60.0 --out ../out/stills_demo
```

#### 2. 导出分镜切点检查接触表（Contact Sheet）
```bash
cd app
# 导出每个分镜切点前后各 2 帧的对比图，检查硬切与转场是否干净
bun scripts/render.ts sheet --track demo --cuts --cols 4 --out ../out/demo_cuts_sheet.png
```

#### 3. 测量 GPU 帧耗时性能基准（Perf Benchmark）
```bash
cd app
bun scripts/render.ts perf --track demo --from 10 --to 20 --samples 1
```

#### 4. 导出 1080p60 / 4K60 完整 MP4 视频（Video Export）
```bash
cd app
# 快速预览草稿导出（4 子帧运动模糊，1080p60）
bun scripts/render.ts video --track demo --samples 4 --shutter 0.2 --preset veryfast --out ../out/demo_draft.mp4

# 终极母带级导出（自适应 4~324 子帧蒙特卡洛运动模糊，CRF 16）
bun scripts/render.ts video --track demo --samples auto --shutter 0.2 --out ../out/demo_master_1080p60.mp4

# 原生 4K60（3840×2160）超采样导出
bun scripts/render.ts video --track demo --scale 2 --samples auto --shutter 0.2 --crf 18 --x264 aq-mode=3:rc-lookahead=30 --out ../out/demo_master_4k60.mp4
```

---

### 2.6 自动化质量门禁与测试验证命令

在日常开发或提交代码前，执行以下三条标准命令即可完成全栈验证：

```bash
# 1. TypeScript 全量静态类型检查（覆盖 engine, plugins, scenes, studio-app, studio-server）
cd app && bun run typecheck

# 2. Vitest 引擎与范式门禁单元测试（9 个测试套件，37 项断言）
cd app && bun run test

# 3. Vite 生产环境双入口打包验证（index.html + studio.html）
cd app && bun run build

# 4. Python 多曲目解析与曲目包构建单元测试（5 项断言）
python3 -m unittest discover -s analysis/tests -v
```

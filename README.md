<div align="center">
  <img src="docs/assets/yinglv.svg" width="64" height="64" alt="应律 · YingLv 产品方标" />
  &nbsp;&nbsp;
  <img src="docs/assets/luxi-lab.svg" width="64" height="64" alt="鹿溪联合创新实验室 LUXI LAB" />
</div>

<h1 align="center">应律 · YingLv</h1>

<p align="center">
  <strong>循声应律，逐拍成画</strong><br/>
  <em>Following the beat, shaping sound into vision.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Matrix-知行%C2%B7五动-0D5E42" alt="matrix" />
  <img src="https://img.shields.io/badge/Product-应律%20YingLv-0D5E42" alt="product" />
  <img src="https://img.shields.io/badge/Code-BeatStream-047538" alt="codename" />
  <img src="https://img.shields.io/badge/Lab-鹿溪联合创新实验室-047538" alt="lab" />
  <img src="https://img.shields.io/badge/Stack-TypeScript%20%7C%20Three.js%20%7C%20WebGL2%20%7C%20Python-blue" alt="stack" />
  <img src="https://img.shields.io/badge/Version-v2.5%20LTS-f1c40f" alt="version" />
</p>

<p align="center">
  <b>鹿溪联合创新实验室</b>（LUXI Joint Innovation Lab）出品<br/>
  仓库：<a href="https://github.com/itrilogy/LUCY-YINGLV">itrilogy/LUCY-YINGLV</a>
</p>

---

**应律 · YingLv**（工程代号 `BeatStream`）是鹿溪联合创新实验室「知行·五动」矩阵下的**歌曲节拍与歌词时序动效 MTV 生成引擎**。输入一首歌与一份歌词，算法先做节拍检测（BPM / 强拍 / 段落边界）与歌词时间轴强制对齐，得到逐句、逐字的动态点；再以时间轴为唯一真源，通过**五层正交镜头合成（背景 + 意象 + 点缀 + 字效 + 调色）**与**两段式受控 AI 代码生成**逐帧确定性渲染画面，输出可直接投屏的 1080p60 / 4K60 MTV 视频。面向 **KTV 点播** 与 **年会晚会大屏**，核心价值是**零手工剪辑——改歌词、换模板、重渲染，全流程 100% 确定性可复现**。

---

## ✨ 核心功能一览

| 模块 | 能力定位 | 核心实现机制 |
| :--- | :--- | :--- |
| **多曲目包一键构建 (`build_track.py`)** | 任意歌曲与歌词零代码导入 | 原生支持 `.lrc`、`.txt`、`.js`、`.json` 四种歌词格式；提供 `fast`（零模型权重秒级生成）与 `full/ctc`（Demucs + CTC Viterbi 强制对齐）双模式 |
| **五层正交镜头合成引擎 (`Engine`)** | 电影级多图层音画实时联动 | `0: background`（满幅基底）+ `1: imagery`（亮度抠像主体）+ `2: accent`（滤色点缀线条）+ `3: typography`（`scrimPass` 护盾字效）+ `4: colorGrade`（5 套情绪 LUT） |
| **两段式 AI 智能分镜 (`Shot Program`)** | 零幻觉时间窗 + 受控代码生成 | **阶段一**由模型分组打标，服务端 `fitWindows`/`seal` 独占下拍时间窗与严格接壤校验；**阶段二**生成单层 TypeScript/GLSL 插件，经范式门与 `bun build` 语法门校验落盘 |
| **单镜单层靶向定制 (`write-shot-layer`)** | 人机协同局部精修 | 在工作台任意镜头卡片上针对指定图层槽位输入一句话描述，单独生成并自动挂载合规插件 |
| **41+ 视效插件军械库 (`src/plugins/`)** | 原片整幕与分层插件自由混排 | 内置 19 款「双模自适应（Solo / Layered）」手写插件 + 22 款 `plate-*` 原片场景包装器；支持 `tmp-*` 临时插件经 `tsc` 校验一键晋升为永久固定资产 |
| **确定性实时预监与 4K 离线导出** | 浏览器预览与母带导出逐帧一致 | 每一帧均为歌曲时间 $f(t)$ 的纯函数；离线导出支持 4~324 子帧三进制自适应蒙特卡洛运动模糊与原生 4K60（3840×2160）超采样渲染 |

---

## 🚀 快速开始

### 1. 启动工作台与实时预览播放器

```bash
cd app
bun install
bun run dev
```

在 Google Chrome 中打开：
- **应律 · 独立工程化工作台（Studio Workbench）**：`http://localhost:5173/studio.html?track=demo`（或 `http://localhost:5173/?mode=studio`）
- **编排整曲 1080p60 全屏预览**：`http://localhost:5173/?track=demo&preview=full`
- **原版示范成片（`makeTimeline()`）**：`http://localhost:5173/?track=default`
- **单插件独立沙箱测试**：`http://localhost:5173/?track=demo&preview=effect&effect=hardware-stack`

| 播放器快捷键 | 动作 |
| :---: | :--- |
| `Space` / 点击画布 | 播放 / 暂停 |
| `←` / `→` | 快退 / 快进 ±1 秒（按住 `Shift` 为 ±5 秒） |
| `,` / `.` | 逐帧后退 / 逐帧前进（`1/60` 秒） |
| `[` / `]` | 跳转至上一幕 / 下一幕分镜切点 |
| `l` | 循环播放（Loop）当前分镜窗口 |
| `h` | 隐藏 / 显示底部播放控制栏 |

### 2. 导入新歌曲构建曲目包（`analysis/build_track.py`）

```bash
# 快速模式（无需下载 4GB 声学模型权重，秒级生成 audio.json + lyrics.json + timeline.json）
python3 analysis/build_track.py \
  --track my-song \
  --audio /path/to/song.mp3 \
  --lyrics /path/to/song.lrc \
  --bpm 128 \
  --mode fast

# 完整声学分析与 CTC 强制对齐模式（需安装 analysis/ 下 uv 环境）
cd analysis
uv run python build_track.py \
  --track my-song \
  --audio /path/to/song.mp3 \
  --lyrics /path/to/song.txt \
  --bpm-range 90,150 \
  --mode auto
```

构建完成后刷新 `studio.html`，在顶栏 **`🎵 曲目`** 下拉框中即可直接切换至 `my-song`。

### 3. 离线导出 1080p60 / 4K60 视频（`app/scripts/render.ts`）

```bash
cd app

# 导出指定曲目的 1080p60 母带级 MP4（自适应 4~324 子帧运动模糊）
bun scripts/render.ts video --track demo --samples auto --shutter 0.2 --out ../out/demo_1080p60.mp4

# 导出原生 4K60（3840×2160）MP4
bun scripts/render.ts video --track demo --scale 2 --samples auto --shutter 0.2 --crf 18 --x264 aq-mode=3:rc-lookahead=30 --out ../out/demo_4k60.mp4

# 导出分镜切点对比接触表（Contact Sheet）或关键帧静帧（Stills）
bun scripts/render.ts sheet --track demo --cuts --cols 4 --out ../out/demo_cuts.png
bun scripts/render.ts stills --track demo --t 5.0,25.0,60.0 --out ../out/stills_demo
```

---

## 🧱 工程结构与架构

```text
LUCY-YINGLV/
├── app/                          # WebGL2 确定性渲染引擎与应律工作台 (Bun + Vite + Three.js)
│   ├── index.html                # 沉浸式全屏预览播放器与离线导出宿主
│   ├── studio.html               # 应律 · YingLv (BeatStream) 独立工作台页面
│   ├── studio-server.ts          # 工作台后端服务（DeepSeek 两段式分镜、单层定制、语法门与资产晋升）
│   ├── public/
│   │   ├── favicon.svg           # 应律官方产品方标 Favicon
│   │   └── tracks/               # 多曲目包目录 (default / demo / <custom-track>)
│   ├── src/
│   │   ├── tokens.css            # 鹿溪设计范式 (LUXI Design System v1.1.1) 可执行变量层
│   │   ├── studio-app.ts         # 应律工作台前端主控（支持深林 dark / 源启 light / 沉浸 ink 三主题）
│   │   ├── engine/               # 渲染核心、五层合成器、窗口代数、范式门禁与 37 项 Vitest 单测
│   │   ├── plugins/              # 19 款双模手写分层插件 + 22 款 plate-* 原片包装器 + AI 生成插件
│   │   └── scenes/               # 40 个定制场景源码模块
│   └── scripts/render.ts         # Headless Chrome + WebSocket + FFmpeg 离线导出器
├── analysis/                     # Python 音频声学解构与词级强制对齐工具链
│   ├── build_track.py            # 通用曲目包一键构建 CLI
│   ├── analyze.py                # 节拍网格、下拍、100fps 包络与鼓组/人声瞬态提取
│   ├── align.py                  # CTC Viterbi 词级强制对齐与信号级起振精修
│   └── tests/test_multitrack.py  # 多曲目解析与构建单元测试
├── docs/                         # 开发者与用户文档 (USER_MANUAL.md / ENGINE.md / TREATMENT.md / assets/)
└── 素材/                          # 架构规范、数学推演、工程审计与实施报告知识库
```

详细操作手册与开发规范请参阅：
- **用户与工程手册**：[`docs/USER_MANUAL.md`](docs/USER_MANUAL.md)
- **四阶段工程实施记录与中文全场景手册**：[`素材/PHASE1_TO_4_ENGINEERING_IMPLEMENTATION_AND_USER_MANUAL.md`](素材/PHASE1_TO_4_ENGINEERING_IMPLEMENTATION_AND_USER_MANUAL.md)
- **渲染引擎与场景 API 指南**：[`docs/ENGINE.md`](docs/ENGINE.md)

---

## 🎨 品牌标识与设计范式

本产品严格遵循 **[鹿溪设计范式 · LUXI Design System v1.1.1](https://github.com/itrilogy/LUCY-DESIGN)** 构建：

| 标识 | 预览 | 规范说明 | 源文件 |
| :---: | :---: | :--- | :--- |
| **产品方标**<br>（应律 · YingLv） | <img src="docs/assets/yinglv.svg" width="48" height="48" alt="应律 · YingLv" /> | 鹿溪绿圆角砖 `#0D5E42` + 24 视口业务图形（**银幕画框 + 节拍波形 + 歌词金点**）+ 水平流动溪流 `#00D2FF` + 源启金星 `#F1C40F`；用作 Favicon 与产品标识 | `docs/assets/yinglv.svg`<br>`app/public/favicon.svg` |
| **实验室符号标**<br>（LUXI LAB） | <img src="docs/assets/luxi-lab.svg" width="48" height="48" alt="鹿溪联合创新实验室" /> | 角本位符号标（`Y + 一横`，无方框，按底材取差异色）；与产品方标并排等大展示 | `docs/assets/luxi-lab.svg`<br>`docs/assets/luxi-symbol-on-dark.svg` |

**核心色板（LUXI Core Tokens）**

| Token | 色值 | 职能定义 |
| :--- | :--- | :--- |
| **鹿溪绿** `--luxi-green` | `#0D5E42` | 主底色、品牌识别、稳重底座、全局唯一 Primary 按钮实底 |
| **源启白** `--origin-white` | `#F5F7FA` | 画布背景、面板反白、纯净留白 |
| **进化蓝** `--luxi-cyan` | `#00D2FF` | 水平溪流、节拍波形、数据高亮、键盘 `:focus-visible` 焦点环 |
| **标题金** `--luxi-gold` | `#F1C40F` | 源启星、歌词金落点、命中热区、显著信号（产品次 Accent） |

---

## 📜 致谢与许可（Credits & License）

- **开源底座与示范曲目**：本项目的渲染内核与示范曲目源自开源项目 `pdoom-video`（MIT License）。示范歌曲 *"I'm Upping My P(doom)"* 歌词由 [osmarks](https://docs.osmarks.net/hypha/p%28doom%29_song_objectively_correct_interpretation) 与 [MusicPerson](https://www.udio.com/creators/MusicPerson) 等创作，音频采用 [deckard (@slimer48484)](https://x.com/slimer48484/status/2097752569212756134) 发布的版本。
- **合规边界**：曲库版权与歌词授权由输入方负责，本引擎仅提供时序解析与画面生成能力。引擎代码采用 [MIT License](LICENSE) 开源发布。

---

<div align="center">
  <img src="docs/assets/yinglv.svg" width="48" height="48" alt="应律 · YingLv" />
  &nbsp;&nbsp;
  <img src="docs/assets/luxi-lab.svg" width="48" height="48" alt="LUXI LAB" />
  <p><strong>应律 · YingLv (BeatStream)</strong> · 循声应律，逐拍成画</p>
  <p>© 鹿溪联合创新实验室 · LUXI Joint Innovation Lab · <a href="https://github.com/itrilogy/LUCY-YINGLV">itrilogy/LUCY-YINGLV</a></p>
  <p><em>Following the beat, shaping sound into vision.</em></p>
</div>

# 独立复核：可行性评估、实施路径与管理界面建议

* 创建日期：2026-09-28
* 文档性质：对仓库源码、`素材/` 既有七份文档、以及 `/Users/ic/Project/VoiceStream` 特效实现的独立复核。本文是后续本地工程的决策记录。
* 环境假设：开发与交付机器为 Apple M3 Ultra、96 GB 统一内存。4K 导出不进入本路径的排期与验收；文中仍记下 4K 的实测事实，避免以后把旧 SLA 重新写进计划。
* 采信方式：文中「判断区间」是工程判断，不是测量出来的概率。凡是写了文件、字段、行数、置信度分布的，均来自本次对仓库的直接核对。

---

## 1. 结论（先读这一节）

1. 可以工程化复用的是渲染内核、强制对齐算法和 1080p 离线导出。判断区间约 **60%**。含义是：在这台机器上，用现有技术栈做成「人仍签字、模板覆盖大部分镜头」的本地工作台，路径成立，但要先用第二首歌证伪。
2. 按 `PRODUCT_REQUIREMENTS_DOCUMENT.md` 与 `ENGINEERING_PRODUCTION_ROADMAP.md` 原文交付（无人值守同级画质、向量检索图元、着色器自动生产、八节点数分钟 4K、微服务），判断区间约 **20%**。单点技术都有现成实现，串成那份 SLA 没有证据。
3. 继续维护这一部成片（预览、1080p 导出、必要时 4K）约 **90%**。栈已经跑通。
4. 换一首歌、人来分镜、引擎复用，约 **70%**。前提是把发音表、人工锚点、段落表和恒定 BPM 从 Python 常量挪到曲目目录。
5. 窄产品（数套排版模板、人选题、词级对齐复核、1080p 导出）约 **60%**。这是建议实际建造的产品，不是平台。
6. 管理界面不要先做成完整后台。画面调试台已经在 `app/src/main.ts` 和 `app/scripts/render.ts`。先补一块只读检查条；能改锚点、能改时间轴的部分，等曲目包和 `timeline.json` 落地再接。
7. 部署单元就是这一台 Mac。一条本地命令链：分析 → 复核未签字的词 → 浏览器预览 → 接触表 → `render.ts video` 出 1080p。不引入消息队列、对象存储、API 网关、向量数据库和 CUDA 容器。
8. 整个路径按阶段门管理。G2（第二首可看完，且新代码主要是模板参数和 `timeline.json`）是唯一决定要不要继续产品化的门。G2 不过，产品就停在「引擎复用、每首歌一部手写片」。

---

## 2. 复核时看过什么

### 2.1 本仓库

* `README.md`、`docs/ENGINE.md`、`docs/TREATMENT.md`。
* `app/src/timeline.ts`（82 行）：剪辑点用歌词字符串锚到拍上。
* `app/src/engine/scene.ts`：`Scene` / `Frame` / `PostOverrides`。全库没有场景把 `stateful` 设为 `true`（默认 `false`）。
* `app/src/engine/` 其余模块：`engine.ts`、`gl.ts`、`lines.ts`、`post.ts`、`stroke.ts`、`type.ts`、`lyrics.ts`、`audio.ts`、`hud.ts`、`palette.ts`、`util.ts`、`scale.ts`、`glsl/common.ts`。
* `app/src/main.ts`、`app/index.html`、`app/scripts/render.ts`、`app/package.json`。
* `app/src/scenes/`：约 40 个文件、约 19602 行。最大的几个是 `room.ts`（1461）、`open.ts`（1175）、`bureau.ts`（1108）、`fuse.ts`（1079）、`loss.ts`（1051）。
* `analysis/align.py` 的 `FIX` 与 `refine()`，`analysis/pron.py` 的 `PRON` / `ALT`，`analysis/analyze.py` 的 `SECTION_BARS` 与恒定速度假设，`analysis/qa_plot.py` 与 `zoom.py` 里写死的 `60/132`。
* `data/lyrics.json`：46 行、227 个词，每个词都有 `conf`，17 个词带 `syl`。另有 `extras` 四段（和声尾音、口误式 lead-in、副歌垫音、outro 的 oh 吟唱）。
* `data/audio.json` 的顶层字段（见第 6.2 节）。文件是单行巨 JSON，阅读时用解析器，不要整文件打开。

### 2.2 既有素材

`素材/INDEX.md` 所列七份文档全部读过。诊断章节（歌词是强制对齐、场景与歌词焊死、运行时没有 ASR、GLSL 不宜放进无人值守主路径）与代码一致。PRD、路线图、标签本体论、以及文档里的通过率、命中率、余弦阈值、SLA，没有对应测量，降级为待证假设。采信边界见第 5 节。

### 2.3 VoiceStream

* `src/effects/compositor.ts`（约 907 行）：Canvas 2D 粒子，时钟是 `performance.now()` 与 `requestAnimationFrame`，出生位置用 `Math.random()`。
* `src/effects/RainGlass.ts`：第三方 `raindrop-fx`，液滴物理仿真，折射一张背景照片。
* `src/effects/WaterRipple.ts`：WebGL2 全屏片元，用时间 uniform 做屏幕空间折射。
* `src/backgrounds/match.ts`：离散标签打分（命中加分、多余标签扣分、缺核心标签则否决、`fallback_id`），以及 `TAG_FX` 查表。
* `src/pages/PlayPage.tsx`：玻璃雨、水面、二维粒子按标签开关叠加。

---

## 3. 仓库里实际有的系统

这是一部已经完成的代码音乐视频，加上一套预览与导出共用的确定性引擎。它不是参数化平台的半成品。

### 3.1 三层，以及各自的体量

| 层 | 位置 | 体量与性质 | 换一首歌时 |
|---|---|---|---|
| 场景 | `app/src/scenes/`、`app/src/timeline.ts` | 约两万行手写镜头。`timeline.ts` 用本曲歌词切点，例如 `cut('There was a sudden drop')`。场景内再 `lyrics.get('具体词')` | 整层重写。`prompt` 的 `variant` 与 `hook` 的 `n` 是仅有的参数 |
| 引擎 | `app/src/engine/`、`app/src/main.ts`、`app/scripts/render.ts` | 约两千行。`Scene.render(frame)`、节拍与包络总线、胶囊线、单笔画、字距、后处理、自适应子帧、PBO 回读 | 保持。只在静帧基准通过后改 |
| 分析 | `analysis/`、`data/*.json` | 强制对齐加音乐信号。算法可留，曲目常量不可留 | 算法改成读曲目目录；常量挪走 |

运行时零语音识别。`Lyrics.load()` 依次尝试 `data/lyrics.json`、`data/lyrics.approx.json`。预览循环里用 `lineAt(t)` 做查表。`main.ts` 的播放时钟用 `<audio>` 元素播 `audio/pdoom.mp3`，再用 `performance.now()` 把浏览器给的粗粒度 `currentTime` 补平滑。这个时钟只驱动「现在播到哪」，不参与画面公式。画面由 `engine.render(t)` 决定，`t` 是歌曲时间。

### 3.2 引擎契约（已经存在，G0 期间不要改）

`Scene`（`app/src/engine/scene.ts`）：

* `stateful` 默认 `false`。为 `true` 时，seek 之后引擎会按固定步长 preroll，并且 `Engine.render` 在自适应采样路径上直接抛错，要求改用固定 `--samples`。当前没有任何场景打开它。新模板保持 `false`。
* `handlesTransition`：重叠段由场景自己合成 `f.under`。默认由引擎交叉淡化。本片的硬切是窗口相接、不重叠。
* `render(f, out)` 必须把半精度线性 HDR 目标全部盖住。返回值是可选的 `PostOverrides`（曝光、泛光、色差、暗角、颗粒、抖动、变焦、HUD 等）。

`Frame` 上场景能读到的总线：

* `t`、`dt`、`lt`、`p`、`start`、`end`、`seeked`、`preroll`。
* `beat`、`bar`、`beatPhase`、`barPhase`。
* `a`：`rms`、`low`、`mid`、`high`、`vocal`、`drums`、`bass`、`other`、`kick`、`snare`、`hat`、`vonset`。
* 转场：`under`、`tin`、`tout`。

确定性规则（`docs/ENGINE.md`，与实现对得上）：

* 禁止 `Math.random()`、`Date.now()`、以及用 `performance.now()` 决定画面。
* 60 fps 上的闪烁用 `frameIdx(t)`，不用 `Math.floor(t * 60)`。后者会在快门积分里把两种状态叠进同一输出帧。
* 随连续时间变化的哈希噪声会被子帧平均掉，并迫使自适应采样把步数拉高。要闪烁就用 `frameIdx(t)` 做种子。
* 导出时子帧乱序、数量不固定。场景输出只能依赖 `t`。

调色板在 `palette.ts`：ink、ink2、graphite、ash、bone、signal、ember、blood，外加只在少数镜头出现的 acid。`docs/TREATMENT.md` 禁止另一套色相，禁止通用粒子星云、镜头光晕和「看起来像生成图」的画面。这条风格约束是模板准入条件，不是文案。

### 3.3 时间轴现在怎么切

`makeTimeline(lyrics, audio)`：

* `cut(歌词子串, nth, tol)`：找到该行第一个词的 `start`，再取不晚于该时刻的最后一拍。`dense` 使用 `tol = 0.05`，因为 “Post” 比拍早 32 ms，避免把上一句切成两半。
* `after(歌词子串)`：取最接近该行 `end` 的下拍。
* `outro` 优先用 `audio.sections` 里名为 `outro` 的段起点。
* 场景模块用 `import.meta.glob('./scenes/*.ts')` 懒加载。一个文件可以服务多段（`prompt` 三次、`hook` 四次），靠 `params`。
* `shoggoth` 条目带 `maxSamples: 108`。注释写明：半分辨率 G-buffer 在子帧之间闪，自适应采样会追到 324，而 108 与 324 在观感上分不开。这是已有的「重镜头封顶采样」机制，新的 `heavy` 模板沿用它，不要为了压耗时去改采样器。

`outro.ts` 在结尾倒放前面各镜头，并倒放开头。这段剪辑依赖全片，不能当成与前后无关的切片。本地单机导出本来就按整段或按 `--from/--to` 人工分段，不需要为它设计分布式切分器。若以后手工分段，切点落在镜头硬切上，避开 outro 的倒放区间。

### 3.4 预览与导出已经提供的操作

预览（`cd app && bunx vite`，默认 `http://localhost:5173`）：

| 操作 | 行为 |
|---|---|
| 空格，或点击画布 | 播放 / 暂停 |
| 左右方向键 | ±1 秒；按住 Shift 为 ±5 秒 |
| `,` / `.` | ±1 帧 |
| `[` / `]` | 上一个 / 下一个镜头 |
| `l` | 循环当前镜头 |
| `h` | 隐藏底部 64 px 控制条 |
| `?t=23` | 从该秒开始 |
| `?scale=2` | 物理分辨率按 2 倍渲染（逻辑排版仍是 1920×1080） |
| `?only=open,loss` | 只加载列出的镜头 |
| `?export=1` | 给 `render.ts` 用。此时 `#ui` 与错误条被 CSS 关掉，画布固定 1920×1080 |

底部控制条已经有：各镜头色块（可点跳）、范围滑杆（步进 0.001 秒）、一行状态（时间、拍、小节、镜头 id、fps、当前歌词行、是否循环）。场景模块热更新时，`main.ts` 按文件名调用 `engine.reload`。`body.export` 必须保持无界面，检查条不能画进导出帧。

导出（`app/scripts/render.ts`）：

* `stills`：指定时间点的 PNG。这是作者对画面的主要检查手段。
* `sheet`：一段时间的接触表。`--cuts` 可打在每个镜头边界。
* `perf`：含 GPU 同步和像素回读的每帧毫秒数。
* `video`：1080p60（`--scale 2` 才是 4K）、x264、AAC。`--samples auto` 的阶梯是 4、12、36、108、324，快门默认在文档示例里用 `--shutter 0.2`。误差用显示域、最差的 2×2 逻辑像素块估计，默认容差 3/255。
* `plates`：重生成 `public/plates/`，outro 的倒放蒙太奇用这些静帧。
* `--from` / `--to` / `--only` 已能分段。WebSocket `inflight: 4`，浏览器用 `readRenderTargetPixelsAsync` 把原始 RGBA 推给本机 ffmpeg。1080p 一帧约 8.3 MB，4K 一帧约 33.2 MB。
* 渲染进行时不要用带 HMR 的 dev server。`PDOOM_NO_HMR=1`，或让 `render.ts` 自己起无 HMR 的私有服务。

依赖（`app/package.json`）：运行时只有 `three` ^0.186.0 与 `opentype.js` ^2.0.0。没有 GSAP、没有后期效果库。Playwright 与 Vite 在 devDependencies。这和「视觉全部手写」的判断一致。

### 3.5 分析管线里哪些是算法、哪些是这首歌

算法，换歌后保留：

* Demucs `htdemucs_ft` 四轨分离，以及 Mel-Band RoFormer 提干声。`common.STEM_OFFSET_SEC` 补偿编码器延迟（歌词 notes 写的是约 −23 ms）。
* MMS_FA 与 wav2vec2-large-lv60k 的 CTC 发射矩阵。主路径是六路融合：两个模型 × 单声道、左、右。帧长约 20 ms（`ctc_emissions.py`）。文档某处写成 10 ms，以代码与 `lyrics.json` 的 notes 为准：20 ms。
* `ctcalign.py` 的约束 Viterbi、行间 star token（吸收呼吸、和声、非歌词人声）。
* `align.py` 的 `refine()`：休止起振（≥50 ms 静音后，能量比 CTC 早 >40 ms 则前移）、谱通量吸附、摩擦音（约 4–10 kHz）前移、衰减释音（约 60 ms 内较峰值掉 15 dB）。
* `analyze.py` 的包络：100 fps，单极点，attack 10 ms、release 90 ms。底鼓、军鼓、踩镲来自鼓轨。

曲目常量，必须挪走，否则第二首歌会系统性偏：

* `pron.py` 的 `PRON` / `ALT`：`P(doom)` → `pee doom`，`ChatGPT,` → `chat gee pee tee`，`NVDA` → `en vee dee ay`（备选 `envidia`、`nvidia`），`RLHF` → `are el aitch eff`，`Neumann's` → `noymans` 等。这是显示词到发音子词的表，不是通用发音编译器。未知词会丢掉非字母字符再按空格拆，专有名词会错。
* `align.py` 的 `FIX`：约 15 组 `(行号, 词序号) → start/end/syl/conf`。例如第 5 行 `eat` 钉在 20.27 s、`alive` 钉在 21.35 s；第 40 行末段副歌主唱被垫音盖住，整句钉在 124.52–125.66 s，置信低至 0.35–0.45；各副歌的 `I'm` 钉在 22.76、59.13、95.47 s。注释写明这些是看声谱图之后的人工覆盖。
* `analyze.py` 的 `SECTION_BARS`：intro、verse、pre、chorus、bridge、outro 的小节号，连同和声进行注释（Eb Bb Cm Ab 等）。这是这首歌的结构，不是检测器。
* 恒定速度：全曲拟合出一个 BPM（结果 132.007，周期 0.45452 s）。`qa_plot.py` 与 `zoom.py` 另外写死 `60/132`。自由变速、3/4、弱起规律不同的歌，这套网格会偏。
* `whisper_run.py` 需要人工 `initial_prompt` 才能稳住术语。Whisper 在这里是交叉校验，不是对齐主路径。`mlx-whisper` 只在 Apple Silicon 上。Linux 服务若将来真的要做，换 faster-whisper 或 whisper.cpp。本路径不部署 Linux 服务。

`lyrics.json` 的置信度是现成的复核信号，227 个词全部有 `conf`：

| 区间 | 词数 |
|---|---|
| [0.00, 0.40) | 2 |
| [0.40, 0.50) | 2 |
| [0.50, 0.60) | 3 |
| [0.60, 0.70) | 19 |
| [0.70, 0.80) | 45 |
| [0.80, 0.90) | 77 |
| [0.90, 1.01) | 79 |

低于 0.60 的 7 个词，就是 `FIX` 里那些主唱被盖住或模型互相矛盾的点。低于 0.70 的一共 26 个，适合作为复核队列的默认阈值。低于 0.80 的有 71 个（约 31%），列表太长，不适合当默认队列，可以做开关。`extras` 记录了四段「有人声但不是词表里的行」，复核界面要能看见，避免把和声尾音收进词边界。

### 3.6 资源事实（本路径不追 4K，但数字留在这里）

来自 `README.md`，机器是 M5 Pro，不是本机，不能直接当成 M3 Ultra 的耗时：

* 4K 全曲约 2.5 小时。静帧约 40 ms 起，光线步进在 108–324 子帧时单帧可超过 10 秒。
* 一条 4K 管线：无头 Chrome 约 5 GB，ffmpeg 约 4 GB。CRF 16 时 4K 码率约 670 Mbit/s，全曲约 13 GB；CRF 18 约 450 Mbit/s；CRF 20 约 230 Mbit/s。颗粒是按物理像素画的，所以码率下不来。
* 分析权重约 4 GB，在 `analysis/.cache/`，用完可删。分离与识别的显存峰值大约 6–10 GB 这一量级（素材文档的估计；本机 96 GB 统一内存覆盖得住，不构成设计约束）。

本路径的交付格式是 1080p60 预览与 1080p60 导出。M3 Ultra 96 GB 改变的是部署形态：分析和渲染串行放在同一台机器上，内存红线、多机拼接、Spot 实例都不进入设计。它不改变作者时间是瓶颈这一事实。光线步进镜头在 1080p 预览里仍然可能掉帧；排版镜头按 `docs/ENGINE.md` 的目标，单帧力争低于 25 ms。两档预算分开写，不要写成全片 16.6 ms。

---

## 4. 可行性分项

| 目标 | 判断区间 | 依据 |
|---|---|---|
| 继续维护这一部成片 | 约 90% | 预览、导出、对齐数据都在。风险是改引擎时没有静帧基准，所以 G0 先做基准 |
| 第二首：人分镜，引擎复用 | 约 70% | 引擎 API 够用。分析常量、`timeline.ts` 的歌名词、场景内 `lyrics.get` 是三处焊点 |
| 窄工作台：模板 + 复核 + 1080p | 约 60% | 不需要新语言或新运行时。取决于 G2 测到的复用比例 |
| 既有 PRD / 路线图全文 | 约 20% | SLA、余弦 0.72、三次自愈到 85%、150–300 个图元后命中 90%，都没有测量 |

60% 是当前工程决策的基数。第二首歌用来测量两件事：引擎 diff 有多大，对齐复核花了多少人时。测量结果出来之前，不增加服务、不增加向量库、不把画质承诺写成「与本片同级且无人值守」。

---

## 5. 既有素材文档：采信与降级

### 5.1 采信

* `VOICE_RECOGNITION_AND_LYRICS_WORKFLOW.md` 的硬事实：运行时没有 ASR；任务是强制对齐；模型只出概率；精度来自发音表、Viterbi、DSP 和 `FIX`。与 `align.py`、`pron.py`、`lyrics.ts` 一致。
* `VISUAL_SYSTEM_AND_PRODUCTIZATION_EVALUATION.md` 第 1–2 节：没有第三方动效库；`Frame` 总线是场景里手写读取的；`timeline.ts` 的字符串、文化隐喻、恒定 BPM 与 `FIX` 会让「直接换歌」失败或变成错位画面。
* `AUTONOMOUS_GENERATION_PIPELINE_FEASIBILITY.md` 里这一条限制：把 WebGL / SDF 代码生成放进无人值守主路径，GLSL 零容错，复杂距离场一次写对的比例很低。主路径因此不生成着色器。
* `P_DOOM_VIDEO_SYSTEM_EVALUATION.md` 对导出链路的描述：Playwright、WebSocket、`inflight`、PBO、ffmpeg。与 `render.ts` 和 `main.ts` 的 `__pdoom.stream` 一致。自适应采样是三进制嵌套（4→12→36→108→324），这一描述与 `docs/ENGINE.md` 一致。

### 5.2 降级（保留原文，不作为实施规格）

| 文档中的说法 | 降级原因 | 本路径怎么处理 |
|---|---|---|
| 三十分钟端到端，画质对齐本片 | 场景约两万行，和歌词隐喻焊在一起 | 不设这个工期，也不设这个画质承诺 |
| 分析可直接容器化，独立度 8.5/10 | 算法可复用；`PRON`、`FIX`、`SECTION_BARS`、恒定 BPM 不可 | 先数据化，再考虑任何服务。本路径不做服务 |
| 余弦相似度 0.72 触发资产赤字 | 没有嵌入、没有标注集、没有标定过的阈值 | 不设阈值。缺模板的信号是：同一类镜头在两首歌里都找不到可接受的模板 |
| 150–300 个图元后命中率 90%，冷启动人工 60%–80% | 可复用图元库目前是空的。高质量镜头是隐喻，不是 uniform | 用第二首歌数实际复用了多少行 |
| 带报错回喂后着色器语法通过率到 85%，视觉符合预期率不足 5% | 没有在本仓库测过 | 不当成产能模型。新模板由人写，用 `tsc`、接触表、`perf` 准入 |
| SSIM ≥ 0.995 且 PSNR ≥ 55 dB | 颗粒、抖动、自适应采样是故意的，像素级相似度会误报 | 固定采样（1 或 4），比对时去掉颗粒层，或只比对结构。阈值等第一套基准图出来再定，不先写 0.995 |
| 8 节点、5–6 分钟内 4K；单 Worker ≤ 8 GB | 与 README 的 2.5 小时、Chrome 5 GB + ffmpeg 4 GB 不符。八路切片的合理预期是几十分钟量级，而且 4K 已移出本路径 | 1080p，单机，`--from/--to` 已够用 |
| Linux CUDA 容器中运行 `mlx-whisper` | mlx 是 Apple 专用 | 本机继续用 mlx。不设计 CUDA 镜像 |
| 十二维对仗本体编译成着色器 | 这些轴没有落到已有的 uniform、折线或字号上 | 模板标签用五到八个离散词，每个词都对应一个已有模板 |
| `VisualEffectPlugin`、RabbitMQ、Qdrant、Kong、OpenTelemetry、创作者分成 | 控制面今天是 `timeline.ts` 的 82 行。没有第二个作者，也没有第二首歌 | G2 通过之前不建 |
| 全片预览 ≤ 16.6 ms、Draw Call ≤ 15 | 引擎文档的目标是 25 ms；光线步进镜头更慢，并且已用 `maxSamples` 承认成本 | 分 `light` / `heavy` 两档 |

文档之间还有一处帧长不一致：系统评估写 CTC 步长 10 ms，歌词 notes 与对齐文档写 20 ms。实施时以 `analysis/` 代码为准。

---

## 6. 技术栈：留、改、不引入

### 6.1 留下

* TypeScript、Vite、Bun、Three.js r186、WebGL2、自写 GLSL3。预览和导出共用 `t → 画面`。这是栈上最有价值的性质。
* `LineBatch`（实例化胶囊 SDF，逻辑像素坐标，物理像素上做 AA）、`stroke.ts`（无字距表字体的光学字距与笔尖弧长）、`type.ts`（Archivo / Plex Mono / Cormorant，`layout` 与 `glyphX` 保留相邻字形的字距）、`post.ts`（泛光金字塔、halation、肩部调色、颗粒、色差）。
* Playwright 驱动的无头 Chrome、本机 WebSocket、ffmpeg libx264。1080p 导出继续走这条链路。
* Python 分析用 uv。本机用 PyTorch MPS 与 mlx-whisper。96 GB 够一次加载分离模型再加载声学模型，仍然建议串行，方便失败时知道是哪一步。

### 6.2 三份契约（字段按现有文件，不重发明）

`lyrics.json`（已存在）：

* 顶层：`lines`、`extras`、`notes`。
* 行：`i`、`text`、`start`、`end`、`words`。
* 词：`w`、`start`、`end`、`conf`，可选 `syl: [start, end][]`。
* 渲染侧 `Lyrics` 会把直引号收成排印引号，并填 `line`、`index`、`gi`。曲目包里保存分析器写出的原词，不保存这些派生字段。

`audio.json`（已存在）：

* `duration`、`bpm`、`beat_period`、`time_signature`、`beats[]`、`downbeats[]`。
* `sections[]`：`{name, start, end}`。pdoom 有 14 段，首段 intro 为 0–2.056 s。
* `fps`（100）以及等长包络数组：`rms`、`low`、`mid`、`high`、`vocal`、`drums`、`bass`、`other`。长度 15666，对应约 156.65 s。
* `onsets`：`kick`、`snare`、`hat`、`vocal`。
* `notes`：时间轴是无间隙 mp3 解码；Demucs 有固定偏移。

G1 允许把「单一 `bpm`」扩展成可选的 `tempo_map`（若干 `{start, bpm}`）。旧字段保留，pdoom 的单速度结果照旧填写，这样现有 `AudioData` 不用先改。速度曲线的读取只在分析侧和切点吸附时需要；场景继续用 `beatAt` / `downbeats`。

`timeline.json`（新文件，G2 起成为剪辑的权威来源；G1 结束时可以先由 `makeTimeline()` 导出一份，供对照，仍以 TypeScript 为准）：

```json
{
  "song": "pdoom",
  "entries": [
    {
      "id": "open",
      "template": "open",
      "startAnchor": { "line": "I see sparks", "nth": 0, "place": "start" },
      "endAnchor": { "line": "There was a sudden drop", "nth": 0, "place": "word", "snap": "beat" },
      "params": {},
      "maxSamples": null
    }
  ]
}
```

切点解析规则与今天的 `cut()` 相同：锚到词，再吸到拍上，容差可按条目写。解析结果缓存进同一文件的 `resolved: {start, end}`，分析重跑后视为脏，预览启动时若词时间与缓存不一致就重新解析并在检查条上标出来。不要在模板代码里写秒数。

模板清单（G2 的四个母题开始就带上，即使暂时只有四条）：

```json
{
  "id": "slam",
  "source": "hook",
  "tags": ["slam", "chorus", "type", "light"],
  "consumes": ["word", "beat"],
  "cost": "light",
  "params": { "n": { "type": "integer", "min": 1, "max": 4 } }
}
```

`cost: "heavy"` 的模板必须声明 `maxSamples`（参照 shoggoth 的 108），并且在预览里允许掉帧。`consumes` 只允许 `word`、`beat`、`envelope` 三种，对应已经存在的总线，避免模板私自读全局。

### 6.3 不引入

* WebGPU 重写。没有第二首成片之前不动。
* 新的动效运行时、粒子引擎、`raindrop-fx`。
* RabbitMQ、Qdrant / Milvus、Kong / Envoy、Prometheus / OpenTelemetry、多租户与计费。
* Docker 沙箱里的自动修着色器循环。
* 为了「以后上云」而拆出的音频微服务。G1 的交付物是 `align.py --song <id>`，不是容器镜像。

---

## 7. VoiceStream 特效：逐项决定

VoiceStream 是环境声混音播放器。画面层的时间模型与本引擎相反：粒子状态沿真实时间积分，随机数决定出生。本引擎的导出要求任意时刻的画面由歌曲时间决定，并且子帧可以乱序。因此不能把合成器或雨玻璃接进 `Scene.render`。风格上，`docs/TREATMENT.md` 排除通用粒子、光晕和屏保感。下表是实施时的白名单与黑名单。

| 来源 | 决定 | 理由与落点 |
|---|---|---|
| `backgrounds/match.ts` 的打分和 `TAG_FX` | 采纳结构，G3 再用 | 离散标签、命中权重、多余惩罚、缺失惩罚、子集奖励、`fallback_id`、标签到效果名的表。约一百行，能直接改写成「段落标签 → 模板 id」。不采纳它的具体标签词（rain、thunder、fire） |
| `WaterRipple.ts` 的屏幕空间折射 | 仅当某一镜头需要玻璃或水面时，重写为一个 `heavy` 模板 | 片元本身接近 `FSPass`：背景采样、导数偏移、高光。重写约束：uniform 用 `f.t` 而不是墙钟；颜色进线性调色板；波纹事件的出生时间来自 `kick`/`snare` 的 onset 列表（数据），不来自 `Math.random()`；不折射照片，折射的是本引擎已经画好的图层。不作为全片滤镜 |
| `RainGlass.ts` / `raindrop-fx` | 不接入 | 第三方液滴仿真，状态随真实时间走，折射照片，且与版画风格冲突 |
| `EffectCompositor` 的粒子种类 | 不接入 | 种类包括雨丝、玻璃水滴、余烬、萤火、冲击环、火花、散景、划痕、灰尘、残渍。更新函数读 `now` 与 `dt`（墙钟毫秒），`spawnRain` 等用 `Math.random()`。一旦接进场景，自适应采样要么被禁止，要么每子帧得到不同的随机状态 |
| `PlayPage.tsx` 的 CSS 颗粒动画 | 不接入 | 本引擎已有按像素、按 `frameIdx` 的颗粒。CSS `steps` 动画与导出帧无关 |
| Web Audio 混音、手势解锁、Safari 音频图 | 与本项目无关 | 响度与瞬态已经烤进 `audio.json`。预览用一个 `<audio>` 元素播整曲 |

G3 的匹配器按 `match.ts` 的形状写，建议的默认权重先抄它的语义、数字等到有十个以上模板再标定：核心标签一个都没中则否决；命中多加分；模板多带了无关标签则扣分；有完全覆盖时给一笔奖励；没有任何核心标签时用清单里的 `fallback_id`（建议是书写模板，而不是一个空白场景）。随机打散只允许用曲目 id 做种子的 mulberry32，以便同一首歌每次建议相同。VoiceStream 的 `hashSeed` + `mulberry32` 可以参考其写法，种子必须来自曲目，不能来自 `Math.random()`。

---

## 8. 产品管理框架

### 8.1 产品定义

给一首带行级歌词的歌，在本机做出一条词级对齐、切点落在拍上、同一 `t` 得到同一帧的 1080p 短片。作者在三个点签字：低置信词边界、每个镜头用哪一个模板、出片前的接触表。机器测拍、对齐、按时间出画面、导出。

参考片（现有 pdoom 成片）是画面基准和回归神谕。新歌的画质上限允许低于参考片。模板的任务是覆盖「字、线、纸、拍」，不是复刻 shoggoth、中文房间或回形针场。

使用者就是现在的作者（一人或同一台机器上的小组）。不设厂牌自助、不设着色器创作者分成、不设短视频批量账号。这些角色出现在旧 PRD 里，本路径不服务它们。

### 8.2 范围

| | 纳入 | 不纳入 |
|---|---|---|
| 输入 | 音频（沿用现在能解码的 mp3；wav 能直接被分析脚本读即可，不单独立项做格式矩阵）、行级歌词、可增补的发音表 | 无歌词的纯器乐自动出片；开放式听写再出片 |
| 输出 | 浏览器可 scrub 的成片；本地 1080p60 mp4 | 4K 排期、多比例短视频包装、实时直播 |
| 人必须在环 | 置信度低于阈值的词；镜头模板选择；接触表 | 无人值守「上传即交付」 |
| 画质 | 参考片静帧不能回退；新歌用模板的画面接受「低于参考片」 | 承诺每首歌都达到光线步进论文插图的密度 |

### 8.3 四个假设，一门一个

前一个没有放行证据，后一个不开工。

| 门 | 假设 | 放行证据 | 不过则 |
|---|---|---|---|
| G0 | 现有成片可以冻结成回归基准 | 约 20 个镜头、固定采样各 3 个时间点的 PNG 入库；重跑脚本能再生成一份并完成比对 | 先修静帧与导出，不动目录结构 |
| G1 | 分析可以服务任意一首歌的数据布局 | `songs/pdoom/` 含发音、锚点、段落；`align.py --song pdoom` 与 `analyze.py --song pdoom` 产出与当前 `data/*.json` 在词时间和拍网格上一致（允许 notes 文本差异）；脚本本体不再出现歌名、132、`SECTION_BARS` 字面量 | 模板化暂停。对齐仍是每首歌一份 Python |
| G2 | 引擎加少量母题能做完第二首 | 第二首能从头看到尾；新代码主要落在模板参数和 `timeline.json`；G0 静帧仍通过；记录人时 | 路径停在「每首歌手写场景，引擎共用」。G3、G4 取消 |
| G3 | 标签表能减少逐镜头指定 | 同一作者对同一首歌，用表生成的初稿，比从空白 `timeline.json` 手写，修改的镜头条数更少，且接触表仍接受 | 编排保持手写 JSON。匹配器删除或闲置，不继续加向量库 |

产能只记人时，不记 GPU 小时：

* 对齐复核：从 `review.json` 打开到全部签字。
* 粗剪：从音频放进曲目目录，到第一条能连续播放的时间轴。
* 成片：从粗剪到接触表通过并导出 mp4。

这台机器的算力不构成排期。若 G2 的人时主要耗在新的 SDF 上，记录这个事实并停在手写分镜，这是成功的测量，不是失败的工程。

### 8.4 人机分工（每一首重复）

| 步骤 | 机器 | 人 |
|---|---|---|
| 分轨、CTC、refine、拍网格、包络 | 全自动 | 提供音频、行级歌词、发音表初稿 |
| 低置信词与 `extras` | 列出队列 | 改起止或确认「模型是对的」 |
| 切点 | 词锚吸附到拍，解出 `resolved` | 改锚点所用的那一句，或改吸附方式 |
| 选模板 | G3 之后给建议 | 始终可改。G2 期间完全由人写 |
| 画面 | 预览与静帧 | 看接触表，决定导出 |
| 新模板 | `tsc`、接触表、`perf` 出报告 | 写代码并签字。仅 G4 |

---

## 9. 实现框架

### 9.1 依赖方向

```text
songs/<id>/                 发音、锚点、段落、行级歌词、音频指针
        │
        ▼
analysis/                   只读曲目包，写 songs/<id>/out/lyrics.json
                            songs/<id>/out/audio.json
                            songs/<id>/out/review.json
        │
        ▼
songs/<id>/timeline.json    词锚 + 模板 id + 参数
        │
        ▼
app/src/templates/          只 import engine
        │
        ▼
app/src/engine/             不知道歌名，不知道模板 id
        ▲
app/src/scenes/             参考片。只 import engine。不 import templates
```

规则：

* 运行时不 import 某一首歌的常量。歌曲选择来自 URL（建议 `?song=pdoom`）或一个曲目清单 JSON。
* 参考片场景留在 `scenes/`，继续当 G0 的神谕。不把 `room.ts` 改成公共库。
* 模板不得 `lyrics.get('本曲原句')`。词的范围由时间轴条目的锚点推进去，模板只消费「本窗口里的行和词」。
* 分析脚本不写 `app/src`。重跑对齐不会改出一片 TypeScript diff。

### 9.2 曲目包布局（G1 的目录契约）

```text
songs/pdoom/
  song.json           显示名、音频路径、采样率假设、时间轴说明
  lyrics.src.json     行级歌词：[{start, end, text}]，由现在的 lyrics/lyrics.src.js 迁出
  pron.json           现在的 PRON 与 ALT
  anchors.json        现在的 FIX，外加复核界面之后追加的项
  sections.json       现在的 SECTION_BARS，或更直接的 {name, startLine, endLine}
  prompt.txt          Whisper initial_prompt，可空
  audio/              或指向仓库现有 audio/pdoom.mp3 的相对路径，避免拷贝大文件
  out/
    lyrics.json
    audio.json
    review.json
  timeline.json       G2 起
```

`anchors.json` 的一项：

```json
{
  "line": 40,
  "token": 0,
  "start": 124.52,
  "conf": 0.35,
  "reason": "lead buried under ah pad"
}
```

行号会随歌词改版漂移。G1 可以先原样迁移（与今天的 `FIX` 等价，保证 pdoom 字节级接近）。复核界面写入时同时记 `text` 与词面 `w`，重跑时若行号对不上词面，标成冲突，不要静默套用。

`review.json` 由分析脚本生成，人的决定写回 `anchors.json`，不直接改 `out/lyrics.json`。下次分析覆盖 `out/`。这样「机器产物」和「人的签字」不会混在一个文件里互相覆盖。

`review.json` 建议字段：

* `word`：`line`、`token`、`w`、`start`、`end`、`conf`、触发原因（`low_conf`、`model_disagreement`、`refine_moved_gt_40ms` 之一或组合）。
* `extras`：原样带上 `lyrics.json` 的 `extras`。
* `unresolvedPronunciations`：对齐时掉进通用拆词、且全大写或含数字括号的词，例如以后新歌里的缩写。

默认入队条件：`conf < 0.7`，或 refine 把边界移动超过 40 ms，或两个声学模型的边界差超过 40 ms（若脚本已有这个差，就写出来；没有就在 G1 加一个字段，不要为了它重做 Viterbi）。0.7 对应 pdoom 上约 26 个词，队列一个人一次能看完。检查条提供「显示到 0.8」的开关（71 个词）。

### 9.3 进程模型

一条串行命令链，工作目录与今天相同：

1. `cd analysis && uv run python align.py --song <id>`
2. `uv run python analyze.py --song <id>`
3. 浏览器打开预览，查询参数指向该曲目的 `out/`。
4. 人在检查条里改锚点（G1 之后）或改时间轴（G2 之后）。
5. 需要时重跑第 1 步。
6. `cd app && bun scripts/render.ts sheet ...` 看接触表。
7. `bun scripts/render.ts video --samples auto --shutter 0.2 --out ../out/<id>.mp4` 导出 1080p。

不在这条链上加守护进程。模型用完即退出，96 GB 是为了单次峰值，不是为了常驻三个模型服务器。Vite 开发服务器是唯一长期进程。

pdoom 的现有 `data/lyrics.json` 与 `data/audio.json` 在 G1 期间保留为对照。预览在 G1 完成前继续读旧路径。G1 的通过条件包含「新 `out/` 与旧 `data/` 的词时间、拍时间一致」。通过之后，预览改为读曲目包的 `out/`，旧文件留一轮作为备份，再决定是否改成指向 `songs/pdoom/out` 的副本。不要在同一天删除旧 JSON。

### 9.4 质量栏

* 画面：G0 的 PNG。比对用固定 `--samples 1` 或 `4`，同一 `t`，同一 `scale`。颗粒强的镜头要么在比对前用同一套后期关掉颗粒（若后期有独立开关就用；没有就先只锁定排版与几何占多数的时间点），要么接受一个较宽的像素差，并把「结构坏了」定义为人看接触表。不要把 SSIM 0.995 写进脚本里当红灯。
* 对齐：pdoom 回归就是与当前 `lyrics.json` 比词的 start/end。容差建议 5 ms 以内算通过（CTC 帧是 20 ms，5 ms 能抓住意外的四舍五入，又不会把已有人工锚点判失败）。第二首歌没有黄金 JSON，通过条件是复核队列全部签字。
* 性能：`light` 模板在 1080p、单采样下，用 `render.ts perf` 看是否多数帧低于 25 ms。`heavy` 模板记录 `perf` 数字和 `maxSamples`，不设 16.6 ms 红灯。
* 类型：新模板文件必须 `tsc --noEmit` 通过。这是 G4 的准入，也是 G2 写母题时的日常命令。
* 导出洁净：`?export=1` 下检查条不可见，PNG 与视频帧不包含 DOM。

---

## 10. 阶段路径（实施顺序）

### 10.1 G0 冻结基准

目的：以后改 `engine/` 时有一张不会扯皮的图。

做法：

* 用现有 `render.ts stills`，`--samples 1`（或 4，全库统一，写进基准目录的 README 一行说明）。1080p，不要 `--scale 2`。
* 镜头列表取 `timeline.ts` 的 21 个条目（open、loss、prompt×3、hook×4、room、shoggoth、spacetime、ascent、bureau、leftturn、paperclips、fuse、stack、dense、loom、ilya、outro）。每个条目取窗口内三个时刻：开始后约 15% 处、中点、结束前约 15% 处。不要用随机时间。
* 输出目录建议 `out/baseline/g0/`（`out/` 已是渲染产物位置，不进日常 diff 的话，至少把文件名清单和命令写进 `songs/pdoom/baseline.txt`，图可以大，清单必须在库里）。
* 另存一条命令脚本，例如 `app/scripts/baseline-stills.sh`，参数与第一次完全相同，以便重跑。
* 比对第一次可以是人眼看接触表（`sheet --cuts`）。脚本级像素差等有了第二份输出再写，阈值不预设 0.995。

此阶段禁止：改 `Scene`、改场景、改分析、加界面。

完成标志：命令可重跑，21×3 张图有固定文件名，作者看过接触表并认为它们代表当前成片。

### 10.2 G1 曲目包

目的：证明换歌时改的是数据目录，不是算法源码。

做法，按这个顺序，以便每一步都能用 pdoom 对照：

1. 新建 `songs/pdoom/`，把 `PRON`、`ALT`、`FIX`、`SECTION_BARS`、行级歌词、Whisper prompt 迁成 JSON。Python 字典改为加载 JSON。迁完立刻跑一次旧命令，确认在不传 `--song` 时行为不变；再切到 `--song pdoom` 默认读该目录。
2. `qa_plot.py`、`zoom.py` 里的 `60/132` 改为读 `audio.json` 的 `bpm`，或读曲目包。避免两套速度。
3. 恒定 BPM 的拟合留在算法里，但段落边界改从 `sections.json` 来。若拟合出的 `bpm` 与曲目包里的可选覆盖不一致，输出警告，不要静默覆盖人填的拍。pdoom 不填覆盖，继续用拟合结果 132.007。
4. 生成 `review.json`。用第 9.2 节的入队条件在 pdoom 上跑一遍，确认低置信端包含已知的 `I'm` / `P(doom)` 末段副歌（conf 0.35–0.45），而不是把 227 个词全列出来。
5. 与 `data/lyrics.json`、`data/audio.json` 做差分：词 start/end、beats、downbeats、sections。5 ms / 拍网格容差内视为通过。
6. 重跑 G0 静帧命令。画面不应变化，因为渲染输入在数值上相同。若变化，先查时间轴吸附，不要改场景去「追」新图。

`lyrics.get` 在参考片场景里暂时保留。G1 不重构两万行场景。

完成标志：算法文件的 diff 里没有这首歌的秒数和名词；`songs/pdoom/` 被删掉任一 JSON 时脚本失败并指出缺哪个文件；静帧与 G0 一致。

### 10.3 G2 第二首（决策门）

目的：测量复用，不是展示架构。

第二首的选择条件（实施前由作者定一首具体的歌，写进 `songs/<id>/song.json` 的 notes）：

* 有可核对的行级歌词（作者听写或已有文本）。没有文本就不做这一门，因为本系统不是听写器。
* 语言先限英语字母歌词，与当前 CTC 字符表 `{blank, a-z, '}` 一致。中文歌词是另一条分析路径，不放进 G2。
* 速度可以变，但拍号先限 4/4。3/4 会同时冲击吸附、小节相位和模板的「四拍一句」假设。
* 允许有专有名词，用来检验 `pron.json` 与复核队列。不要为了好过门而挑一首只有常用词的歌。

只建四个母题。源文件与抽取方式：

| 母题 id | 从哪抽 | 抽完模板必须做到 | 不要抽进去的东西 |
|---|---|---|---|
| `plotter` | `_motifs.ts` 的火花与 `stroke.ts` 的 `writtenLength` | 给定窗口内的词，笔尖按 `wordProgress` 写完；颜色用 signal / bone | 独角兽、TikZ、PCB、本曲任何名词 |
| `karaoke` | `Lyrics.wordProgress`、`type.ts` 的 `layout` / `glyphX` | 已唱与未唱两色；窗口内自动换行；边距沿用标题安全区 96 px 的量级 | 某一句的手调字距例外 |
| `slam` | `hook.ts` 已有的 `params.n` | 窗口内每个重拍一个词，字号顶满；`n` 只影响力度预设（1–4 档），不写死 “P(DOOM)” | HUD 数字从 0.15 滚到 0.99 的剧本 |
| `paper` | `loss.ts` / `bureau.ts` 的纸面、轴线、等宽字 | 骨色纸、墨线、可开关的坐标轴或表单框；词按打字或沿路径出现 | SAFE ENOUGH 章、MLP 框图、冯·诺依曼示意 |

第二首的 `timeline.json` 完全由人写。允许某一窗口暂时仍用参考片式的手写场景文件，但必须在条目里标 `handwritten: true`，并在结项时统计：手写窗口的时长占比、手写代码行数、四个母题覆盖的时长占比。这三个数就是 G2 的测量结果。

通过：片子能连续看完；G0 静帧通过；手写占比被记录。若手写时长超过一半，或人时主要花在新着色器上，判定假设不成立，路径停在「引擎加手写分镜」。模板代码可以留下，供下一首手写时复制，但不进入 G3。

不通过时仍然留下的资产：曲目包格式、`review.json`、四个母题（如果它们本身能用）。这些不浪费。浪费的是在此之前去做的匹配器和后台。

### 10.4 G3 工作台里的建议器

只在 G2 通过后开始。

* 输入：`audio.json` 的 `sections`、每段的 rms / 瞬态密度、该段词数与语速（词时长的倒数，分析脚本可以加一个派生字段）。
* 规则表：人维护的 JSON，形状同 VoiceStream 的 `TAG_FX`。例如 `chorus + kick_heavy → slam`，`verse + vocal_legato → plotter`，找不到则 `karaoke`。
* 输出：一份带 `suggested: true` 的 `timeline.json` 初稿。预览里能改模板 id，改完去掉 `suggested`。
* 验收用第 8.3 节的 G3 证据：修改条数，而不是余弦分。

水面折射若此时仍被需要，按第 7 节做成第五个模板，走 G4 的准入，不走「从 VoiceStream 拷贝文件」。

### 10.5 G4 缺模板时的旁路

触发条件用次数，不用相似度：同一种需求（作者用同一句话描述的镜头，记在 `timeline` 条目的 `need` 字段里）在两首不同的歌里都无法用已有模板接受，才新写一个模板。

准入三件，全部沿用现有工具：

1. `bunx tsc --noEmit -p app/tsconfig.json`，新文件无错误。
2. `render.ts stills` 或 `sheet`，至少覆盖该模板窗口的头、中、尾。
3. `render.ts perf`，记下 `light` 或 `heavy`，`heavy` 写上 `maxSamples`。

通过后把清单里的 `tags` 补上，G3 的规则表可以引用新 id。没有审查网站、没有自动打嵌入、没有 Docker。

---

## 11. 管理界面

### 11.1 决定

不先完成一整套管理后台。画面调试已经够用。先在现有预览上加一块可收起的检查条；写入能力按阶段打开。提前把标签市场、接触图画廊、模板审核台做完，不会加快着色器调试，而且会把尚未稳定的路径写进界面。

### 11.2 现有界面已经覆盖的调试

文件：`app/index.html`、`app/src/main.ts`。

* 画布点击播放，底部 64 px：镜头标记、滑杆、状态行。
* 状态行内容：`t`、`beatAt`、`barAt`、当前条目 id、约每 500 ms 更新的 fps、`lyrics.lineAt(t)` 的整行文本、循环标记。
* 键盘：空格、左右、逐帧、镜头跳转、循环、隐藏 UI。
* 场景 HMR。
* `engine.errors` 非空时，左上角 `#errs` 显示。导出模式用 `body.export` 把 `#ui` 和 `#errs` 关掉。
* 静帧、接触表、耗时、短片段导出都在 `render.ts`，不在页面上。页面不必重做这些按钮才能调试画面；命令行保持为出图的权威途径，避免页面里再嵌一个 Playwright。

检查条是加在 `#ui` 之上或旁边的 DOM，只在非导出模式出现。它不进入 `Hud.draw`，否则会进成片。

### 11.3 分四次做，每次都能用

| 次序 | 与阶段门的关系 | 界面行为 | 明确不做 |
|---|---|---|---|
| 第一次，只读 | 可与 G0 并行。不读新文件，只读内存里的 `Lyrics` 与 `AudioData` | 当前词的 `w`、`start`、`end`、`conf`（`wordAt` / `lastWord` 已在 `lyrics.ts`）。点击词即 `seek` 到 `start`。镜头标记旁显示 `sections` 名称。`conf < 0.7` 的词用 signal 色标出。展开时列出本镜头窗口内所有词 | 任何保存；不改 64 px 条的快捷键 |
| 第二次，锚点 | G1 的 `anchors.json` 与 `review.json` 落地之后 | 队列：默认 `conf < 0.7`，开关可放到 0.8。改 start/end，写回 `anchors.json`（带 `w` 与原因）。显示 `extras`。提供「重跑对齐」的说明命令；若本机不想从网页起 Python 进程，按钮可以只复制命令。若作者希望一键重跑，用一个仅监听 localhost 的小脚本，不要把 Python 嵌进 Vite 中间件 | 发音表的完整编辑器；波形大图可以后做。第一次签字用数字和时间跳转就够，声谱图不是前置条件 |
| 第三次，时间轴 | G2 开始，第二首用 JSON 剪辑时 | 镜头列表：模板 id、参数里的少量字段、锚点句、`handwritten` 标记。保存 `timeline.json`。预览启动时解析锚点。解析失败（`lyrics.get` 式的找不到句子）显示在 `#errs`，不要静默落到 0 秒 | 拖拽时间线组件、关键帧曲线编辑器。切点仍是词锚加吸附，不是自由拖秒 |
| 第四次，建议 | 仅 G3 | 每个镜头一条建议模板，人接受或改掉 | 向量检索、十二维滑杆、自动写代码 |

只读条的完成标准：播放时眼睛不离开画面，就能看见当前词的时间和置信，并能点进任意一句。它不依赖 G1，因此可以最先做，而且做完不会被曲目包迁移推翻（它只依赖 `Lyrics` 接口，而该接口在 G1 之后仍然读同一形状的 JSON）。

锚点编辑的完成标准：不用打开 JSON，能把队列里的一个词改完并写回曲目包；重跑之后 `out/lyrics.json` 使用新边界；参考片在未改锚点时静帧不变。

时间轴编辑的完成标准：第二首歌的剪辑点改完，刷新预览即生效，diff 出现在 `songs/<id>/timeline.json`，不出现在场景 TypeScript 里。

### 11.4 界面信息架构（就这一块，不是新应用）

建议就在现有页底部扩展，而不是新路由：

* 第一行：保持现在的标记、滑杆、状态。状态行追加当前词和 `conf`，例如 `my 125.20–125.40 conf 0.40`。
* 第二行（`h` 一并隐藏）：词条带。每个词一个按钮，宽度按持续时间占本镜头的比例，低置信着色。
* 侧栏或底部抽屉：复核队列与（G2 后）镜头表。抽屉默认关。导出模式不创建这些节点，双保险是 CSS 加 `if (!EXPORT)`。

快捷键保持不变。新快捷键如果要加，避开已占用的空格、方向键、`,`、`.`、`[`、`]`、`l`、`h`。建议队列用 `j` / `k` 上下条，`enter` 跳到该词。不要做帮助遮罩挡住画面。

### 11.5 为什么不把 render.ts 的按钮做进页面

`stills`、`sheet`、`perf`、`video` 会启动无头 Chrome。开发服务器若带 HMR，导出会在中途重载。这两件事放在页面里容易和预览抢 GPU、抢端口。作者已经有文档化的命令。检查条最多放「复制当前镜头的 stills 命令」，命令里带上当前 `t` 和镜头 id。出图仍在终端。

---

## 12. 一首歌在这台机器上的操作序列

G1、G2 完成后，每首歌固定走这条序列。G0 的参考片不走第 4 步的模板选择，它的时间轴保持与今天一致。

1. 建 `songs/<id>/`。放入音频路径、行级歌词、已知缩写的 `pron.json`。`sections.json` 可以先只写「整首是一首」，分析仍会给拍；段落名等人听完再填，或先按能量粗分再改。
2. `uv run python align.py --song <id>`，然后 `analyze.py --song <id>`。失败时看缺的 stem 或权重，不在网页里隐藏报错。
3. 打开预览 `?song=<id>`。只读条确认有词。打开复核队列，处理 `conf < 0.7` 与 `extras`。决定写进 `anchors.json`。
4. 重跑对齐。队列清空或剩余项被标成「确认无误」后，写 `timeline.json`。G2 期间手写；G3 之后从建议改。
5. 逐镜头播放。`light` 模板看实时画面。`heavy` 模板对头、中、尾跑 `stills` 或 `sheet`。
6. 接触表通过后，`render.ts video` 出 1080p60 到 `out/<id>.mp4`。采样用 `auto`，快门 0.2，与参考片的导出习惯一致。本路径不跑 `--scale 2`。

人时记在曲目的 `song.json` 里一个 `labor` 对象：`reviewMinutes`、`roughCutMinutes`、`finishMinutes`、`handwrittenFraction`。G2 的结项就读这些数。

---

## 13. 明确不做的清单

实施时遇到下列提议，默认拒绝，除非某一扇门的放行证据已经写在曲目笔记里，并且提议直接缩短人时：

1. 4K 导出优化、分布式切片、ffmpeg `-c copy` 拼接集群。本地需要分段时用已有的 `--from/--to`，编码参数保持一致，切在硬切上，避开 outro 倒放。
2. 把单 Worker 内存写成 8 GB 红线。本机 96 GB。若记录占用，记下 Chrome 与 ffmpeg 的实际数即可。
3. 微服务拆分、消息队列、对象存储、API 网关、链路追踪。
4. 向量数据库、十二维对仗打分、余弦 0.72。
5. 主路径上由模型生成 GLSL 或场景 TypeScript。旁路也先由人写，工具只提供 `tsc` 与静帧。
6. 把 VoiceStream 的 `EffectCompositor`、`RainGlass`、CSS 颗粒接进引擎。
7. WebGPU 迁移、替换 Three.js、引入 GSAP 或后期库。
8. 在 G1 之前重写 `scenes/` 以去掉 `lyrics.get`。参考片保持可渲染比「架构干净」优先。
9. 中文 CTC、3/4 拍、无歌词歌曲，放进 G2 的范围。它们各自是独立的分析问题。
10. 单独的管理站点、账号系统、审核工作流状态机。
11. 把 SSIM ≥ 0.995、全片 16.6 ms、Draw Call ≤ 15 写进持续集成红灯。
12. 为了界面先把锚点保存进 `timeline.ts` 或 `align.py` 的字典字面量。保存目标只可能是 `songs/<id>/` 里的 JSON。在那些文件不存在时，界面保持只读。

---

## 14. 建议的首批代码落点（供开工时对照，不是本次已改动的代码）

| 顺序 | 路径 | 动作 |
|---|---|---|
| 1 | `app/scripts/baseline-stills.sh`、`songs/pdoom/baseline.txt` | G0 命令与文件名清单 |
| 2 | `app/index.html`、`app/src/main.ts` | 只读词条检查条；`EXPORT` 时不挂载 |
| 3 | `songs/pdoom/*.json` | 从 `pron.py`、`align.py`、`analyze.py`、`lyrics/lyrics.src.js` 迁数据 |
| 4 | `analysis/align.py`、`analyze.py`、`pron.py`、`qa_plot.py`、`zoom.py` | 增加 `--song`，删除歌名常量 |
| 5 | `songs/<第二首>/` | G1 通过之后才建 |
| 6 | `app/src/templates/plotter.ts`、`karaoke.ts`、`slam.ts`、`paper.ts` | G2，从第 10.3 节所列源文件抽取 |
| 7 | `app/src/timeline.ts` | G2 期间变成「若存在 `timeline.json` 则解析，否则 `makeTimeline`」。参考片在 JSON 与代码一致之前仍走代码 |
| 8 | 规则表 JSON 与建议函数 | 仅 G3。放在 `app/src/edit/`，不要放进 `engine/` |

引擎目录在 G0 与 G1 的 diff 应为空。若静帧比对要求改引擎，先更新基准图并在 `baseline.txt` 写明原因，再继续。

---

## 15. 风险与停机

| 风险 | 表现 | 处理 |
|---|---|---|
| 第二首的价值仍在定制 SDF | 手写时长过半 | G2 判定不通过，停止产品化，保留曲目包与引擎 |
| 对齐在和声密集处不可用 | 复核队列改不完，或改完仍听到词边界错 | 把该段标成「整句一个时间」、模板退化为按行而不是按词。不要为了这一段上更大的声学模型当做默认路径 |
| 曲目包迁移改变了 pdoom 的词时间 | G0 静帧变化，尤其是硬切位置 | 以旧 `data/lyrics.json` 为黄金数据，修锚点或吸附容差，直到静帧回来。不改场景去配合新时间 |
| 检查条被画进导出 | `?export=1` 的 PNG 出现文字 | 导出模式不创建节点；G0 重跑应能抓住 |
| 模板私自使用墙钟或 `Math.random` | 自适应采样变慢或同 `t` 两帧不同 | 代码评审时搜这几个调用。模板目录不允许出现。发现则该模板不能进清单 |
| 把旧 PRD 的工期写回计划 | 出现「三十天平台」「八卡渲染」 | 以本文第 13 节为拒绝清单 |

停机不是停掉参考片的维护。参考片的预览与 1080p 导出在任何一门失败后仍然是这个仓库的首要可运行目标。

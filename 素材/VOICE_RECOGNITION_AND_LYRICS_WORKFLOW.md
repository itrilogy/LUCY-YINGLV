# 语音转义识别与歌词生成工作流深度技术分析

## 1. 核心问题硬事实定性

* 问题一：在人声转义识别与歌词生成方面，是实时，还是需要借助歌词资源？
  1. **物理事实定性**：绝对不是实时运行，且物理上完全无法脱离预置的歌词源资源。
  2. 运行时解耦：视频预览与离线渲染运行器（`app/`）内部没有任何语音识别（ASR）或声学模型推断逻辑，其实时渲染完全依赖离线预烘焙的静态数据文件 `data/lyrics.json`。
  3. 任务范式本质：离线分析管线（`analysis/`）解决的不是开放式“自发人声转义”（Free ASR Transcription），而是严密的**强制对齐（Forced Alignment）**与信号级瞬态修正任务。其前置输入必须包含人工整理的带有粗略行级时间区间的歌词源文件 `lyrics/lyrics.src.js`。

* 问题二：工作流驱动是依赖大语言模型（LLM），还是自行工程化适配？
  1. **物理事实定性**：并非端到端大模型（LLM/MLLM）自主闭环驱动，而是“轻量级专用声学/ASR 模型输出原始概率特征 + 极重度的人工规则、数字信号处理（DSP）与专有算法工程化硬适配”。
  2. 模型资产边界：所采用的模型资产（Demucs、Mel-Band RoFormer、Meta MMS_FA、Wav2Vec2、Whisper Large-v3-turbo）均为底层特征提取工具，不具备全自动编排与视觉语义时序裁决能力。
  3. 核心驱动中枢：整个工作流的高精度核心完全建立在手写发音规则库、Numba JIT 约束 Viterbi 算法、清辅音/谱通量信号微调算法以及大量人工显式修正（Hardcoded Anchors & Fixes）之上。

---

## 2. 歌词处理机制与离线依赖链剖析

### 2.1 歌词数据生命周期与静态烘焙架构
* 阶段一：源歌词输入（Pre-existing Ground Truth）
  1. 外部依赖文件：`lyrics/lyrics.src.js`。
  2. 数据形态：数组存储每行歌词的粗略起止时间与文本（例如 `[1.5, 5.9, "I see sparks of AGI in your eyes"]`）。
  3. 文本属性：这是由人工听写、校对或生成阶段给出的标准真值文本（Ground Truth），系统并未在未知歌词的情况下从音频反向提纯文字。
* 阶段二：离线多阶段声学提取与对齐（Offline Alignment Pipeline）
  1. 运行环境：独立于前端渲染器，通过 Python 3.12+ 与 `uv` 依赖管理器执行 `uv run python align.py`。
  2. 耗时特征：依赖多模型推理与信号分析，全曲分析需要数分钟，属于典型的高延迟离线预处理阶段。
* 阶段三：轻量化时序元数据产出（Static Production Artifact）
  1. 产出目标：`data/lyrics.json`。
  2. 数据结构：包含词级（Word-level）与音节级（Syllable-level）绝对时间戳、起始/结束边界判定规则分类标签以及统计置信度分值。
* 阶段四：前端零开销时间轴寻址（Zero-runtime Overhead Playback）
  1. 渲染引擎 `src/engine/lyrics.ts` 在初始化时通过 `fetch('data/lyrics.json')` 载入内存。
  2. 渲染循环中直接调用 `Lyrics.wordProgress(word, t)` 或 `Lyrics.lineCharProgress(line, t)` 进行毫秒级时间二分查找，完全规避了实时运行 ASR 的算力损耗与不可预测的延迟抖动。

### 2.2 为什么无法实现“无歌词资源实时识别”？
* 伴奏掩蔽效应与信噪比劣化
  1. 强电子合成器与底鼓打击乐与主唱人声高度混叠。即使采用 Demucs 进行四轨分离，在副歌阶段仍存在严重的立体声双轨合唱、伴唱和声垫音（Backing Pad）与长混响尾音。
  2. 开放式实时 ASR 模型在此类高噪伴奏环境下极易发生词汇漏读、幻觉（Hallucination）或时间戳严重平移。
* 领域特定专有名词（OOD Domain Specific Terms）识别失效
  1. 歌曲充斥极密集的 AI/CS 专业黑话：`P(doom)`、`FOOM`、`shoggoth`、`shinigami`、`Chinchilla`、`basilisk`、`Omega Point`、`RLHF`、`GPU`、`CDR`、`MLP`、`NVDA`、`Gato`、`Sydney`、`Ilya`、`Loom`。
  2. 通用语音模型在此类未微调术语上会产生致命转义错误（如将 `P(doom)` 识别为 `feed them`，将 `NVDA` 识别为普通单词，将 `RLHF` 识别为无意义辅音串）。

---

## 3. 工作流驱动架构：模型层 vs 工程化规则层

### 3.1 模型层定位：原始声学特征发生器
* 架构角色划分
  1. 模型在此系统中绝非“决策智能体”，仅充当“连续信号到离散概率张量映射的传感器”。
* 模型资产清单与物理输出
  1. **Demucs (`htdemucs_ft`)**：
     * 作用：基于混合时域-频域网络进行 4 轨分离，提取人声音轨。
     * 输出：立体声人声波形文件（`vocals.wav`）。
  2. **Mel-Band RoFormer (`audio-separator`)**：
     * 作用：在分离出的人声基础上二次提纯，消除立体声混响与伴唱，剥离出绝对干声。
     * 输出：单声道主唱干声（`lead.wav`）。
  3. **Meta MMS_FA & Wav2Vec2-Large-LV60k**：
     * 作用：非自回归字符级 CTC 预测头。
     * 输出：步长为 20 ms 的全时序发射概率矩阵（Emission Matrix），维度为 $T \times |\Sigma|$，其中字符表 $\Sigma \in \{ \text{blank}, a-z, ' \}$。
  4. **Whisper Large-v3-turbo (`mlx-whisper`)**：
     * 作用：用于提供独立的时间戳候选参考。
     * 依赖注入：在 `whisper_run.py` 中必须由工程师手工输入定制的提示词诱导参数 `initial_prompt`，提前告知专业术语前置背景；若脱离该人工引导，Whisper 无法稳定识别专有术语。

### 3.2 自行工程化适配层：核心决策中枢
* 核心一：领域专有发音编译器 (`analysis/pron.py`)
  1. 作用机制：构建从视觉展示 Token（Display Token）到声学拼读子词（Pronunciation Sub-words）的解析映射引擎。
  2. 映射实现：代码显式定义缩写词的字母级展开与连读拼写：
     * `P(doom)` $\to$ `pee doom`
     * `ChatGPT,` $\to$ `chat gee pee tee`
     * `NVDA` $\to$ `en vee dee ay`（备选 `envidia`）
     * `RLHF` $\to$ `are el aitch eff`
     * `Neumann's` $\to$ `noymans`（德语音标音译）
     * `Killswitch` $\to$ `kill switch`
* 核心二：Numba JIT 加速约束 Viterbi 算法 (`analysis/ctcalign.py`)
  1. 六轨联合后验概率融合（Fused6）：
     * 对 Demucs 提取的单声道、立体声左声道、立体声右声道，分别计算 MMS 与 Wav2Vec2 的 CTC 对数概率矩阵，在对数域进行 6 轨几何加权平均：
       $$\mathcal{L}_{\text{fused6}} = \text{logaddexp}\left(\sum_{m \in \{\text{mms}, \text{lv60k}\}} \sum_{s \in \{\text{mono}, L, R\}} \log P_{m, s}\right) - \ln(6)$$
  2. 垃圾吸收标记机制（Garbage / Star Token）：
     * 在行与行之间以及曲首曲尾插入通配符状态。其每帧发射得分为全字符最优概率减去固定边界余量（Margin），用于自动吸纳伴唱和声、叹词呼吸声与非歌词人声，防止 Viterbi 动态规划发生全局雪崩式路径错位。
  3. 时间窗口刚性约束（Anchors）：
     * 在 Viterbi 递推回溯中通过 `lo[j]` 与 `hi[j]` 参数施加严格的时间上下界，强制对齐路径只能在物理合规的时空走廊内延伸。
* 核心三：基于物理声学信号的边界细化引擎 (`align.py` 中的 `refine()`)
  1. CTC 固有缺陷：CTC 声学模型在平稳长元音（Held Vowels）上往往发射滞后，在清辅音上发射在气流爆破尾端而非摩擦起点。
  2. 信号级修正算法集：
     * **休止符起振检测 (`rest-onset`)**：若前序存在 $\ge 50\text{ ms}$ 的静音，而 RMS 能量在 CTC 字符判定前 $>40\text{ ms}$ 处剧烈抬升，强制将词头向前捕捉到能量起始点。
     * **谱通量瞬态吸附 (`onset-snap`)**：在 CTC 判定点前计算短时傅里叶变换的谱通量（Spectral Flux）峰值，吸附连音（Legato）声门塞音。
     * **高频摩擦音感知前移 (`fricative`)**：针对 `s, sh, ch, z, f, th, j, h` 开头的辅音，检测 4~10 kHz 频段能量比（Sibilance Ratio），将边界前移至高频湍流噪音的实际爆发原点。
     * **衰减能量释音判定 (`decay-release`)**：通过连续 60 ms 内 RMS 能量较峰值下跌 15 dB 的物理跌落点裁决长音终止边界。
* 核心四：人工硬编码专家修正字典 (`align.py` 中的 `FIX`)
  1. 算法边界的硬介入：无论模型与启发式算法多么复杂，在复杂混音极限场景下仍存在物理不可分性。
  2. 源码显式覆盖点：代码中维护了多达 15 组基于声谱图人工标定的绝对微调字典 `FIX`：
     * 第 5 行：`eat me alive` 中 `eat` 的辅音释放点定死为 20.27 秒，`alive` 弱读定死为 21.35 秒。
     * 第 11 行：`shinigami eyes` 的元音切换点定死为 34.73 秒。
     * 第 40 行：副歌收尾 `I'm upping my P(doom)` 中主唱被背景和声垫音完全淹没，CTC 模型全面失效，工程师直接通过中值滤波频谱硬编码为 124.52s ~ 125.40s。
     * 副歌弱起乐句 `I'm`：在所有副歌爆发点前 2.5 拍处，手动锁定人声切入点（22.76s, 59.13s, 95.47s），彻底推翻 CTC 模型平滑错误。

---

## 4. 结论与工业化启示

* 工作流本质归纳
  1. 该系统在人声识别与歌词对齐维度，展现的是典型的**现代严谨信号工程思维**，而非盲目依赖端到端大模型黑盒。
  2. 其成功依赖于：**明确的文本先验（歌词源） + 专用声学模型概率特征提取 + 极其细致的 DSP 物理信号校准 + 关键临界点的人工硬编码介入**。
* 产品化复制代价
  1. 若试图将其转化为全自动 SaaS 服务，最大瓶颈并非算力，而是这套“工程化规则与人工校验介入”的自动化泛化能力。
  2. 脱离了人工发音字典维护（`pron.py`）与临界盲区修正字典（`FIX`），单纯依靠端到端大模型输出的时间戳，其视觉对齐精度会立即发生明显的音画脱节，无法达到本项目所呈现的亚像素级卡拉OK排版视觉品质。

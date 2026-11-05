# I'm Upping My P(doom) 项目全维度技术调研与工程评估报告

## 1. 项目定位与架构总览

* 系统本质
  1. 本项目是一个高保真、高精度的音频驱动生成式程序化音乐视频（Code-rendered Music Video）生成系统。
  2. 核心架构采用“离线精准音频多模态解构”与“时序确定性 WebGL/Canvas2D 实时+离线双模渲染引擎”相分离的双阶段架构。
  3. 任何时刻 $t$ 的画面是歌曲时间轴的纯确定性数学函数，消除了传统视频渲染中的累积漂移与时间步长污染，实现了浏览器内 60 FPS 交互式实时预览与无头浏览器离线 4K60 广播级渲染的像素级完全一致。

* 核心管线切分
  1. 音频特征分析与音素对齐管线（Python / PyTorch / Demucs / MMS / Whisper）：从原始混音中剥离人声与伴奏分轨，解算恒定速度节拍网格，并生成词级与音节级时序对齐矩阵。
  2. 确定性图形渲染管线（TypeScript / Three.js / WebGL2 / Canvas2D）：构建场景图、基于 Instanced Capsule 的线段批处理渲染、基于 Jimenez 算法的 HDR/Bloom 后处理通道以及光学字距单笔画排版。
  3. 离线无头合成与编码管线（Bun / Playwright / WebSocket / FFmpeg）：通过非阻塞异步像素回读（PBO）与具有背压控制的 IPC WebSocket 管道，将无头 Chromium 输出的未压缩原始帧直接流式灌入 libx264 编码器。

---

## 2. 代码调用链路深度剖析

### 2.1 音频分析与对齐模块（Python Pipeline）
* 阶段一：音轨分离（Stem Separation）
  1. 调用 `demucs.htdemucs_ft` 模型，将混音音频 `audio/pdoom.mp3` 解构成 drums、bass、other、vocals 四个立体声独立音轨。
  2. 通过 `audio-separator` 驱动 Mel-Band RoFormer 模型从人声音轨中剥离混响与和声，提纯出干声主唱 `lead.wav`。
  3. 补偿由于 Demucs 卷积下采样引入的固定延迟偏移量（`common.STEM_OFFSET_SEC`）。
* 阶段二：声学模型发射概率解算（Acoustic Emission Estimation）
  1. `ctc_emissions.py` 分别加载 Meta MMS_FA 和 wav2vec2-large-lv60k 预训练模型。
  2. 对主唱人声以及伴奏混合人声计算逐帧（10 ms 步长）的 CTC 字符对齐对数概率矩阵（Log-probabilities）。
  3. 对主唱单声道、立体声左声道与右声道分别解算并执行 6 轨概率密度加权融合（`PRIMARY = "fused6"`），增强双轨重叠人声的抗噪能力。
* 阶段三：词级与音节级 Viterbi 强制对齐（Forced Alignment）
  1. `align.py` 驱动 `ctcalign.py` 执行全曲全局约束 CTC Viterbi 动态规划，在行与行之间引入带阻尼权重的垃圾吸收标记（Star Token），防止呼吸声与混响尾音导致路径偏移。
  2. 通过 `whisper_run.py`（基于 Apple Silicon 优化的 `mlx-whisper` large-v3-turbo）生成的绝对时间戳执行双向交叉校验。
  3. 提取 5 ms 步长的声学特征（RMS 能量阶跃、基频 Pitch 轮廓、谱质心 Spectral Centroid），在元音与辅音释音点处进行信号级边界修正，产出 `data/lyrics.json`。
* 阶段四：音乐信号学与节拍动力学分析（Musicology & Dynamics）
  1. `analyze.py` 通过短时傅里叶变换（STFT）与梅尔滤波器组，提取低频底鼓（Kick）与混音谱通量（Spectral Flux）。
  2. 采用频域自相关粗搜与底鼓瞬态微调两段式算法拟合出全局恒定速度网格（132.007 BPM）。
  3. 基于二阶巴特沃斯（Butterworth）带通滤波器分离频段，以 100 FPS 生成低、中、高频及各乐器分轨的非对称单极点包络（One-pole IIR Follower），产出 `data/audio.json`。

### 2.2 核心渲染引擎模块（Engine Pipeline）
* 阶段一：生命周期初始化（Engine Initialization）
  1. `main.ts` 实例化 `Engine`，解析 URL 检索参数（`export`、`scale`、`only`、`t`）。
  2. `Engine.init` 并行触发资源异步加载：`AudioData.load()`、`Lyrics.load()`、`loadFonts()`（Opentype.js 载入 Archivo、IBM Plex Mono、Cormorant Garamond）以及 `loadStrokeFonts()`（SVG 矢量单笔画字体解析）。
  3. 触发 `makeTimeline` 生成切片元数据表，按需动态加载当前视口激活的场景模块（`import.meta.glob`）。
* 阶段二：时序驱动与状态积分（Deterministic Frame Dispatching）
  1. `Engine.render(t, dt, toScreen, samples, shutter)` 接收歌曲绝对物理时间 $t$。
  2. 检索当前激活场景 $e \in \text{Timeline}$。若场景标记为有状态（`scene.stateful = true`）且遭遇时间跳变（Seek），引擎自动触发前卷回溯机制（Preroll），从 $\max(e.\text{start}, t - e.\text{prerollMax})$ 开始以固定 $\frac{1}{60}\text{ s}$ 步长进行状态积分更新，确保动力学系统的状态严格重现。
  3. 计算音频瞬态上下文并封装为 `Frame` 对象（注入音频特征切片 $f.a$、连续节拍索引 $f.\text{beat}$、小节相位 $f.\text{barPhase}$ 及场景交叉淡入淡出权重 $f.\text{tin}, f.\text{tout}$）。
* 阶段三：场景自渲染与离屏合成（Scene Rendering & Compositing）
  1. 激活场景执行 `scene.render(frame, outRT)`，将几何图元或全屏片元着色器光线步进结果写入物理分辨率的半精度浮点渲染目标（RGBA16F RenderTarget）。
  2. 若存在多场景重叠，`Engine.composite` 通过双缓冲 RT 与 `xfade` 着色器按节拍网格进行线性加权混合。
  3. 场景可选择性返回后期参数覆盖字典 `PostOverrides`（曝光、泛光强度、色差系数、暗角、晃屏偏移量等）。
* 阶段四：自适应时间过采样与运动模糊（Adaptive Motion Blur Sub-sampling）
  1. 离线模式下，若指定 `--samples auto`，引擎初始化三进制偏移序列（Ternary Offsets）。
  2. 迭代阶梯 $N \in [4, 12, 36, 108, 324]$，每次迭代在快门时间窗 $[t - \frac{\Delta t \cdot \text{shutter}}{2}, t + \frac{\Delta t \cdot \text{shutter}}{2}]$ 内采集两倍于历史点集的新子帧，并累加至 `newRT`。
  3. 执行 `Engine.sampleError`，通过 GPU 块级最大值归约通道计算显色空间的 $L_\infty$ 范数变化量。当预估余项误差小于容差阈值（默认 3/255）时提前收敛截断。
  4. 将累加浮点纹理通过替换模式归一化写入 `avgRT`。
* 阶段五：全局后处理链（Post-processing Chain）
  1. 叠加 HUD 层（`Hud.draw`）：基于 Canvas2D 动态生成裁切线（Crop marks）、P(doom) 仪器读数与歌词标记并上传为 GPU 纹理。
  2. 进入 `Post.render`：依次执行 Jimenez 13-tap 下采样与 9-tap 上采样生成 7 级 MIP 双向泛光金字塔、分离式 Halation 红色散射光晕、指数肩部色调映射（Exponential Shoulder Tone Curve）、全分辨率程序化胶片颗粒注入（Film Grain）以及边缘色差（Chromatic Aberration）。
  3. 结果输出至 `finalRT`（RGBA8 格式）。

### 2.3 离线转码与流式吞吐链路（Render & Export Pipeline）
* 阶段一：宿主启动与上下文握手
  1. `render.ts` 启动 Bun 内置私有静态 HTTP 服务（若 Vite 未运行），禁用 HMR（`PDOOM_NO_HMR=1`）。
  2. 通过 `playwright-core` 启动 Chromium 无头实例，注入硬件加速参数（`--use-angle=metal`、`--enable-gpu-rasterization`、`--ignore-gpu-blocklist`）。
  3. 页面就绪后，挂载全局通信句柄 `window.__pdoom`。
* 阶段二：双工 WebSocket 管道与流式背压
  1. Bun 宿主通过 `Bun.serve` 开辟低延迟 WebSocket 服务端，同时利用 `Bun.spawn` 启动 `ffmpeg` 子进程，打开 `pipe:0` 原始视频输入管道。
  2. 浏览器内部执行 `__pdoom.stream({ from, to, fps, ws, samples, shutter, inflight: 4 })`。
  3. 针对每一帧，浏览器调用 `renderer.readRenderTargetPixelsAsync`，利用 WebGL2 像素缓冲对象（PBO）在 GPU 驱动层异步完成物理显存向主机内存的传输。
  4. 浏览器将未压缩的原始 RGBA 二进制帧（1080p 为 8.29 MB，4K 为 33.17 MB）通过 WebSocket 写入。
  5. Bun 服务端在将数据写入 `ffmpeg.stdin` 并调用 `flush()` 后，立即通过 WebSocket 回传递增 ACK。
  6. 浏览器采用滑动窗口机制，限制未确认飞行帧数最大为 4 帧（`inflight <= 4`），当编码器卡顿时自动暂停渲染，从物理层面防止 4K 巨量内存积压引发 OOM 崩溃。
* 阶段三：容器封装与色彩空间转换
  1. FFmpeg 接收 `rawvideo` 格式的 RGBA 数据流，执行 `-vf vflip` 翻转 OpenGL 默认的自底向上坐标系。
  2. 应用 `libx264` 编码器参数：指定 CRF 16（视觉无损）、`-preset slow`、`-pix_fmt yuv420p`、`-tune grain`（保留高频颗粒质感）以及 `-x264-params aq-mode=3`（自适应量化防止暗部条带）。
  3. 对齐原始音频分段并编码为 320 kbps AAC，完成 MP4 封装。

---

## 3. 数学性与理论深度评估

### 3.1 确定性函数系统与时间连续统映射
* 状态解耦定理
  1. 系统的全局图像状态可严格表示为纯函数映射：$I(t): \mathbb{R}^+ \to \mathbb{R}^{W \times H \times 4}$。
  2. 该映射在非跳切点（Within-plate）处几乎处处连续，完全杜绝了物理模拟中由于时间步长漂移 $\Delta t$ 导致的不可重现性问题。
  3. 伪随机数发生器完全脱离宿主环境时钟，底层全量采用 Mulberry32 散列发生器与基于整数比特异或移位（Xorshift / Wang Hash）的几何着色器噪声：
     $$\text{hash}(u) = \text{fract}(\sin(u \cdot 12.9898 + \dots) \times 43758.5453)$$
  4. 帧率锁定与高频抖动消除：着色器与脚本内的离散振荡严格依赖离散快门时间函数 $\text{frameIdx}(t) = \lfloor t \cdot \text{FPS} \rfloor$，杜绝在快门积分周期内发生二次曝光伪影。

### 3.2 自适应时间过采样与蒙特卡洛误差收敛
* 三进制嵌套网格（Ternary Nested Shutter Grid）
  1. 运动模糊本质是时间维度上的一维定积分：
     $$\bar{I}(t) = \frac{1}{\Delta \tau} \int_{t - \frac{\Delta \tau}{2}}^{t + \frac{\Delta \tau}{2}} I(\tau) \, d\tau, \quad \Delta \tau = \frac{\text{shutter}}{\text{FPS}}$$
  2. 传统二进制倍增采样（2, 4, 8, 16...）会导致新增采样点中心偏向时序后半轴，测得的代数差包含了“相机运动带来的几何位移”而非“纯离散阶梯误差”。
  3. 本项目创造性地采用对称三进制细分（Ternary Subdivision）：初始阶段布置 4 个等距分布点，后续各级将每一子区间三等分，在原有采样点两侧对称补入采样点：
     $$u_k \in \left\{ \frac{3m + 0.5}{3n} - 0.5, \, \frac{3m + 2.5}{3n} - 0.5 \right\}, \quad m \in [0, n-1]$$
  4. 任意阶梯的前缀集合大小均保持严格的时间对称与均匀分布，使得新旧点集均值之差为纯采样误差测度。
* 误差递推估计与早停准则（Error Estimation & Convergence Criterion）
  1. 由于运动边缘的阶梯离散拷贝衰减速率严格与采样数成反比 $O(1/N)$，当采样规模从 $n$ 扩充到 $3n$ 时，已消除的误差为差值的 $2/3$，剩余理论截断误差可严密估计为：
     $$\epsilon_{\text{remain}} \approx \sum_{k=1}^\infty \frac{\Delta}{(3)^k} = \frac{\Delta}{2}$$
  2. 误差评估在降采样的 $2 \times 2$ 逻辑像素块（Physical $B \times B$ 块）上执行，映射至非线性 sRGB 感知空间后计算最大色度差 $L_\infty$ 范数。若 $\epsilon_{\text{remain}} < \text{tol}$，迭代立即终止。静态场景采样数稳定在 12 次，大幅运动场景自动攀升至 108 或 324 次，实现了算力与图像质量的 Pareto 最优解。

### 3.3 几何解析学与光线步进算法
* 三维带符号距离场（3D Signed Distance Fields, SDF）与软混合
  1. 在 `shoggoth.ts` 与 `shoggoth-glsl.ts` 中，环状生物与触手群采用闭合参数方程结合三维欧氏骨架推导：
     $$d_{\text{TorusKnot}}(p; p_k, q_k, R, r) = \| p - \gamma(\theta) \| - r(\theta)$$
  2. 触手生成采用变径圆锥胶囊 SDF（Cone Capsule SDF），并利用多阶多项式平滑极小值函数（Smooth-Min）实现解剖学级别的有机组织融合：
     $$s_{\min}(a, b, k) = -k \cdot \ln(e^{-a/k} + e^{-b/k})$$
* 刚体三维变换与 Rodrigues 旋转矩阵
  1. `room.ts` 构建了完整的虚拟针孔相机内参矩阵，相机姿态插值与刚体运动完全通过无奇异性的 Rodrigues 旋转向量公式驱动：
     $$\mathbf{v}_{\text{rot}} = \mathbf{v}\cos\theta + (\mathbf{k} \times \mathbf{v})\sin\theta + \mathbf{k}(\mathbf{k} \cdot \mathbf{v})(1 - \cos\theta)$$
  2. 结合阻尼简谐振子方程（Damped Harmonic Oscillator / Spring Dynamics）解算切镜震颤（Dutch angle snap）与重音晃动：
     $$\ddot{x} + 2\zeta\omega_n \dot{x} + \omega_n^2 x = 0$$

### 3.4 信号处理与声学对齐数学模型
* 双模型 CTC 联合后验概率对齐
  1. 连接时序分类（CTC）模型输出条件概率分布 $P(\pi | \mathbf{x})$，通过前向-后向算法计算联合后验矩阵。
  2. 本项目融合两个独立声学模型的发射对数概率（Log-softmax 矩阵）：
     $$\mathcal{L}_{\text{fused}}(c, t) = \alpha \log P_{\text{MMS}}(c, t) + (1-\alpha) \log P_{\text{Wav2Vec2}}(c, t)$$
  3. 引入行间静音惩罚惩罚项构建转移约束网格，通过动态规划（Viterbi）求解全局最高似然路径 $\pi^* = \arg\max_\pi P(\pi | \mathbf{x}, \text{Lyrics})$。
* 频域包络与不对称滤波跟随器
  1. 音频特征通过非对称单极点 IIR 数字滤波器平滑，阶跃响应具有不同的上升与释放时间常数：
     $$y[n] = \alpha \cdot y[n-1] + (1 - \alpha) \cdot x[n], \quad \alpha = \begin{cases} e^{-1/(\tau_{\text{attack}} \cdot f_s)}, & x[n] > y[n-1] \\ e^{-1/(\tau_{\text{release}} \cdot f_s)}, & x[n] \le y[n-1] \end{cases}$$
  2. 该滤波器保证了视觉冲击力（底鼓冲击瞬态快速拉起）与视觉余晖（高频释放指数级衰减）的高度统一。

---

## 4. 工程学实现与系统质量评估

### 4.1 核心架构优良特性
* 硬件资源流控与背压设计（Backpressure Management）
  1. 避免了常规无头渲染器将整段视频帧缓存于内存导致 OOM 崩溃的问题。
  2. 利用 WebSocket 二进制通道和滑动窗口协议，限制前端 Chromium 生成帧与宿主 FFmpeg 编码器消费帧的速度差，内存开销恒定在 $O(K \cdot W \cdot H)$，其中 $K \le 4$。
* 非阻塞异步 GPU 数据提取（PBO Pipeline）
  1. 规避了传统 WebGL `gl.readPixels` 引发的 CPU-GPU 强同步管线停顿（Pipeline Stall）。
  2. 在 WebGL2 层面封装 `renderer.readRenderTargetPixelsAsync`，利用底层的 Pixel Buffer Object (PBO) 与 Sync Fence 进行双缓冲异步回读，4K 模式下单帧显存拷回耗时由 150 ms 缩短至微秒级（异步等待），吞吐效率提升数倍。
* GPU 实例几何体封装（Instanced Capsule Line Batcher）
  1. 全量放弃 Three.js 原生低效的 `THREE.Line` / `LineSegments`（存在原生 WebGL 线宽受限为 1px 的硬件瓶颈）。
  2. 使用单个 `InstancedBufferGeometry` 挂载两端点坐标、颜色及线宽属性，在片元着色器中以胶囊体 SDF 计算解析抗锯齿边缘（SDF Capsule AA）。
  3. 支持单 Draw Call 吞吐 20 万段任意朝向、自发光叠加（Additive Linear HDR）的高保真矢量线段。
* 完备的光学字距计算引擎（Custom Optical Kerning Engine）
  1. 针对无字距表的单笔画绘图机字体（Hershey / EMS SVG Fonts），自研 90 阶水平切片投影算法（Profile Bands）。
  2. 在像素空间解算轮廓外扩与 45 度投影遮蔽，动态调整字符前后间距，填补了现代排版引擎在单线矢量书写动态生成领域的空白。

### 4.2 架构缺陷与工程隐患
* 物理分辨率与逻辑分辨率的隐式耦合
  1. 引擎设计在 1920×1080 逻辑像素下排版，在 4K 模式（`--scale 2`）下通过宏 `SCALE` 与 `PX_SCALE` 调整着色器常量与 Canvas2D 变换。
  2. 部分着色器依赖原生 `dFdx`、`dFdy` 或 `fwidth`，若未包裹 `pxLine` 辅助函数，在高 DPI 渲染下线条物理粗细会骤降一半，带来隐蔽的显示器异构渲染缺陷。
* 内存泄漏与场景生命周期清理不彻底
  1. `Scene.dispose` 接口在部分复杂场景（如 `room.ts`、`shoggoth.ts`）中仅释放了局部的 BufferGeometry，未深度遍历材质引用的离屏纹理（`FSPass.dispose()`、`Layer2D.canvas`）。
  2. 长时间预览或跨场景密集 Seek 会导致显存显式占用持续单调递增，存在显存泄漏隐患。
* 单体巨型场景文件（Monolithic Scene Files）
  1. 场景代码存在显著膨胀，单文件代码行数超千行（如 `room.ts` 达 1462 行，`bureau.ts` 达 51 KB）。
  2. 复杂的数学常量、几何顶点数组、GLSL 着色器源码内联于业务逻辑中，违反单一职责原则，极大地增加了模块单元测试与协同维护的难度。

---

## 5. 可复用性与模块解耦评估

| 模块名称 | 独立度评级 | 接口设计成熟度 | 依赖耦合点 | 外部提取/泛化改造成本 |
| :--- | :--- | :--- | :--- | :--- |
| **音频对齐分析器 (analysis/)** | **高 (8.5/10)** | 脚本级输出 (JSON Schema 规范清晰) | 深度依赖 Demucs、MMS 模型权重与 uv 环境 | 低：直接输入任意音频与歌词文本，即可沉淀为独立微服务 |
| **GPU 线段批处理器 (LineBatch)** | **极高 (9.5/10)** | 完备的对象式 API (`seg2`, `polyline`, `render`) | 仅依赖 Three.js 与底层 WebGL2 | 极低：可直接抽离为独立 npm 包发布 |
| **自适应运动模糊引擎 (Engine.render)** | **中等 (6.0/10)** | 内部深度绑定 Timeline 与特定 HDR 目标结构 | 与 `Post` 模块及 `Three.js` 内部类紧密耦合 | 中：需重构为独立的渲染遍通道（RenderPass）方可泛化 |
| **单笔画矢量排版引擎 (stroke.ts)** | **极高 (9.0/10)** | 纯几何计算，输入 SVG 输出点集轨迹与时间 | 仅依赖轻量级几何工具函数 | 极低：易于移植到任意 WebGL/WebGPU 排版中间件 |
| **具体业务场景 (src/scenes/*)** | **极低 (2.5/10)** | 与本首歌的歌词、BPM、旋律停顿高度硬编码 | 深度依赖特定音频时间戳与自定义字形几何体 | 极高：属于典型的项目专属艺术资产，无法直接复用 |

---

## 6. 产品化可行性深度调研

### 6.1 商业化 / SaaS 化形态设想
* 核心产品模式
  1. **自动化代码驱动 MV 生成平台**：用户上传音频并填入歌词，后端自动执行音轨分离与强制对齐，渲染器套用预设模板自动生成动态排版视频。
  2. **高保真矢量动态排版云渲染 API**：面向广告制作、动态海报设计、卡拉OK字幕生成等场景，提供高分辨率运动模糊的图形导出引擎。

### 6.2 产品化实施障碍与风险对冲矩阵
* 算力成本陷阱与延迟不平衡
  1. 物理现实：在 Apple M5 Pro 设备上，全曲 4K60 导出耗时高达 2.5 小时，单帧耗时在复杂光线步进场景下可达 10 秒以上。
  2. 云端成本分析：若在公有云部署 GPU 实例（如 AWS g4dn.xlarge 或 g5.xlarge 配备 A10G），单次渲染计算成本达数十美元，远超普通 C 端用户的付费意愿。
  3. 优化路径：云端必须实施分段切片渲染架构（Distributed Chunk Rendering），将音频按小节划分为数十个并行段落，在分布式无状态节点集群渲染后进行无损 FFmpeg 级联拼接。
* 无头浏览器（Headless Chrome）在云端的稳定性与并发隔离
  1. Chromium 在 Linux Docker 容器中启用 GPU 硬件加速存在驱动碎片化陷阱（NVIDIA Container Toolkit、EGL 抽象层支持复杂）。
  2. 多实例并发运行极易发生 GPU 上下文丢失（WebGL Context Lost）或显存争抢崩溃。
  3. 替代方案：长期演进应将 WebGL 渲染管线移植至 WebGPU 或 Node-C++ 原生图形引擎（如 Dawn / Vello / Skia），剥离整个重量级无头浏览器外壳。
* 竞争方案横向对比
  1. **对比 Remotion**：Remotion 专注于 React DOM/SVG 的轻量级合成，生态完备，但缺乏底层 HDR 浮点管线、无自适应蒙特卡洛运动模糊、无单笔画排版引擎，在极限视觉质感上存在代差。
  2. **对比 After Effects (AE Scripting)**：AE 具有极高的工业视觉上限与丰富的插件，但属封闭商业软件，无法在 Linux 无头容器中弹性伸缩，API 调度极其沉重且无法实时在浏览器内交互预览。
  3. **对比 TouchDesigner / Notch**：专业实时交互软件，强依赖专用运行时与高昂商用授权，不具备 Web 标准通用性与现代 Web 前端工具链的敏捷开发优势。

---

## 7. 系统资源开销与硬件依赖模型

### 7.1 物理资源消耗基线
* 离线分析阶段（Python Pipeline）
  1. **显存 (VRAM)**：Demucs + RoFormer 分离需 6~8 GB；MMS + Wav2Vec2 + Whisper Large-v3 阶段瞬态占用约 8~10 GB。
  2. **系统内存 (RAM)**：全精度音频加载与傅里叶变换矩阵解算占用约 8 GB。
  3. **磁盘空间**：PyTorch 及 HuggingFace 模型权重约 4.5 GB（可通过缓存清理脚本重置）。
* 4K60 离线导出阶段（Render Pipeline）
  1. **显存 (VRAM)**：Chromium 单进程在 4K 模式下开辟多个 RGBA16F / RGBA32F 离屏纹理，显存占用稳定在 4.5~6.0 GB。
  2. **系统内存 (RAM)**：无头 Chrome 占用约 5 GB；FFmpeg libx264（慢速预设 + aq-mode=3 分析视窗）占用约 4 GB；IPC 双向 WebSocket 缓冲约 1 GB。单渲染管线推荐物理内存 $\ge 16\text{ GB}$。
  3. **CPU 负载**：多进程体系（Bun、Chrome GPU 进程、FFmpeg 编码进程）可完全榨干 8~12 核心，CPU 维持在 85%~95% 高位运转。

### 7.2 存储与网络吞吐指标
* IPC 内部带宽
  1. 4K 分辨率单帧原始像素为 $3840 \times 2160 \times 4 \approx 33.17\text{ MB}$。
  2. 在 60 FPS 速率下，瞬态内部总线吞吐带宽高达 $1.99\text{ GB/s}$。因此，网络层必须限制为本机环回（Loopback Unix Domain Socket 或内存映射管道），杜绝任何跨主机网络传输。
* 输出视频码率
  1. 默认 CRF 16 参数下，由于片元着色器实时计算的高频独立像素胶片颗粒（Film Grain）破坏了帧间宏块压缩预测，4K 视频输出码率高达 670 Mbit/s（整曲产物达 13 GB）。
  2. 产品化推荐参数：将 CRF 调升至 20~22，并启用 `-tune grain`，可将码率压制在 150~230 Mbit/s，文件体积收敛至 3~4.5 GB。

---

## 8. 平台适配性与异构环境兼容评估

* 操作系统平台支持
  1. **macOS (Apple Silicon)**：原生第一支持级（Tier 1）。项目针对 Metal ANGLE 后端进行了深度调优（`--use-angle=metal`），且 `mlx-whisper` 利用统一内存架构运行效率最高。
  2. **Linux (Ubuntu 22.04 LTS Server)**：支持（Tier 2）。需要配置 NVIDIA 官方专有驱动、`nvidia-container-toolkit`，并显式指定 Chromium 启动参数 `--use-gl=angle --use-angle=gl-egl`，规避无 X11 环境下的渲染崩溃。
  3. **Windows**：理论支持（Tier 3）。需要解决 Bun 运行时跨平台兼容性、FFmpeg 路径映射及 Direct3D11 ANGLE 转换层的浮点精度差异。
* 浏览器端兼容性
  1. 实时预览模式（1080p）深度依赖 WebGL2、`EXT_color_buffer_float`、`OES_texture_float_linear` 扩展，主流现代浏览器（Chrome 105+、Firefox 110+、Safari 16.4+）均可无缝支持。
  2. 离线流式导出模式强绑定基于 Chromium 的 Playwright 驱动，非 Chromium 内核无法使用内部专有 GPU 控制标志与无头性能保障。
* WebGPU 演进路线可行性
  1. 当前 Three.js 正在全面推进 `WebGPURenderer` 与 TSL (Three Shading Language)。
  2. 本项目底层深度利用了原生 GLSL3 全屏片元 Pass、MRT 自定义管道与原始 PBO 异步回读，向 WebGPU 迁移需要彻底重写所有着色器代码（转换为 WGSL），但在计算着色器（Compute Shader）支持下，三维光线步进与粒子物理模拟将获得 2~3 倍的原生性能跃升。

---

## 9. 技术栈全景与依赖矩阵

```mermaid
graph TD
    subgraph Audio_Pipeline[音频多模态解构管线 (Python)]
        A1[原始音频 MP3] --> A2[Demucs: 4轨音轨分离]
        A1 --> A3[Mel-Band RoFormer: 干声提取]
        A2 & A3 --> A4[MMS & Wav2Vec2: CTC 发射概率]
        A4 --> A5[mlx-whisper: 词级时间戳校验]
        A5 --> A6[Viterbi 约束对齐: lyrics.json]
        A2 --> A7[Librosa & Scipy: 频域包络与节拍网格]
        A7 --> A8[audio.json]
    end

    subgraph Engine_Pipeline[确定性渲染管线 (TypeScript / WebGL)]
        B1[lyrics.json & audio.json] --> B2[Timeline: 节拍对齐切片调度]
        B2 --> B3[Scene Graph: 3D几何与SDF片元场景]
        B3 --> B4[LineBatch: GPU胶囊线段批处理]
        B3 --> B5[StrokeEngine: 单笔画矢量排版]
        B3 --> B6[Adaptive Sampler: 三进制嵌套时间过采样]
        B6 --> B7[Post-processing: Jimenez Bloom & Halation]
        B7 --> B8[HDR to sRGB: Shoulder Tone Mapping]
    end

    subgraph Export_Pipeline[无头转码与合成管线 (Bun / Playwright)]
        C1[Playwright: Headless Chromium] --> C2[WebGL2 PBO: 异步像素回读]
        C2 --> C3[WebSocket: 带背压控制流式传输]
        C3 --> C4[Bun Server: 进程级管道注入]
        C4 --> C5[FFmpeg: libx264 CRF16 编码]
        C5 --> C6[最终母带: 4K60 MP4]
    end

    Audio_Pipeline --> Engine_Pipeline
    Engine_Pipeline --> Export_Pipeline
```

### 核心技术依赖清单
* **音频端**：
  * Python >= 3.12 (uv 管理工具链)
  * `torch` >= 2.14.0, `torchaudio` >= 2.11.0 (深度学习张量底座)
  * `demucs` >= 4.0.1 (Meta 工业级音轨分离)
  * `audio-separator` >= 0.47.0 (RoFormer 变体分离)
  * `mlx-whisper` >= 0.4.3 (Apple Silicon 专用快速转写)
  * `librosa` >= 1.0.0, `scipy` >= 1.18.1 (音乐信号学与数字信号处理)
* **前端与渲染端**：
  * `typescript` ^7.0.2, `bun` 运行时
  * `vite` ^8.3.0 (极速模块构建与无 HMR 隔离运行)
  * `three` ^0.186.0 (三维图形场景图与 WebGL2 上下文封装)
  * `opentype.js` ^2.0.0 (TTF/OTF 贝塞尔轮廓解析与几何提取)
  * 自研 Single-stroke SVG 轮廓解析器与动态光学字距引擎
* **离线渲染与编码端**：
  * `playwright-core` ^1.63.0 (Chromium 硬件加速无头驱动)
  * `ffmpeg` 6.0+ (集成 libx264 与 high-bitrate AAC 编解码器)
  * Bun Native WebSocket Server (零拷贝字节流传输)

---

## 10. 综合评估结论

* 技术成熟度
  1. 本项目在“数学确定性视觉生成”、“高规格图形学后处理”、“声学对齐精度”以及“GPU-CPU 流式背压工程”四个维度均达到了业界顶尖的代码渲染品质。
  2. 彻底打破了传统视频剪辑软件以时间轴为中心的手工生产范式，建立了以“纯数学时间映射函数”为核心的现代生成式计算机图形学影视生产样板。
* 商业化与产品化落地建议
  1. 若以当前形态直接交付为通用 SaaS，将面临计算成本过高与多端 GPU 异构兼容的巨大挑战。
  2. 极具商业价值的工程路径是将其核心模块进行资产拆分：
     - 将音频对齐与特征提取封装为轻量级微服务；
     - 将自适应运动模糊引擎与 GPU 胶囊线段批处理器封装为底层图形通用库；
     - 在业务层抽象出一套参数化视觉模板 DSL，以切片分布式集群的方式完成云端视频生产闭环。

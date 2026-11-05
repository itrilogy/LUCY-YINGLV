# 参数化视听生成平台系统架构与工程生产路线图 (ADD & Roadmap)

## 1. 系统总体拓扑架构与微服务切分

* 总体架构原则
  1. **控制面与数据面分离（Control-Plane / Data-Plane Decoupling）**：调度中枢仅负责元数据流转、标签计算与 DSL 编译（轻量无状态）；渲染与音视频转码集群负责超高吞吐字节流解算（GPU 密集型弹性集群）。
  2. **异步事件驱动拓扑（Event-driven Asynchronous Topology）**：各处理节点通过分布式消息队列解耦，避免长连接超时与级联崩溃。
  3. **计算纯函数化与无状态横向扩容（Stateless Horizontal Scalability）**：渲染节点无本地持久化依赖，任意节点随时可被抢占或拉起。

```mermaid
graph TD
    subgraph Client_Layer[客户端与网关层]
        Client[Web 前端 / API 网关] --> API_GW[Kong / Envoy API Gateway]
    end

    subgraph Audio_Worker_Pool[音频解构微服务集群 (Python / GPU)]
        API_GW -->|投递音频+歌词| AudioMQ[RabbitMQ: audio_tasks]
        AudioMQ --> Worker_Audio[Audio Processor Worker: Demucs + CTC + Librosa]
        Worker_Audio --> S3[(AWS S3 / 临时存储)]
        Worker_Audio -->|完成事件| EvtAudio[Event: AudioAnalyzed]
    end

    subgraph Orchestrator_Service[视听编排与决策中枢 (Node / Rust)]
        EvtAudio --> Orch[Smart Orchestrator]
        VectorDB[(Qdrant / Milvus 图元向量数据库)] <--> Orch
        Orch -->|命中匹配| CompileDSL[时间轴 DSL 编译器]
        Orch -->|未命中 (资产赤字)| DeficitQueue[RabbitMQ: deficit_tasks]
    end

    subgraph Sidecar_Factory[标准化人机资产工厂 (HITL Sidecar)]
        DeficitQueue --> AssetWorker[Asset Factory Controller]
        LLM_Engine[LLM Code Gen: Claude / GPT-4.5] <--> AssetWorker
        Docker_Sandbox[Docker 隔离编译沙箱: tsc + glsl-ast] <--> AssetWorker
        Headless_Bench[无头压测节点: Stills + Perf] <--> AssetWorker
        AssetWorker --> ReviewPortal[审查员管理后台 UI]
        ReviewPortal -->|人工签署发布| VectorDB
        ReviewPortal -->|触发回流| Orch
    end

    subgraph Distributed_Render_Cluster[分布式切片渲染集群 (Headless Chromium / GPU)]
        CompileDSL --> ChunkScheduler[切片切分与调度器]
        ChunkScheduler --> RenderMQ[RabbitMQ: render_chunks]
        RenderMQ --> Node1[Render Worker 1: 0~15s]
        RenderMQ --> Node2[Render Worker 2: 15~30s]
        RenderMQ --> NodeN[Render Worker N: (N-1)*15~N*15s]
        Node1 & Node2 & NodeN --> S3
    end

    subgraph Stitcher_Node[级联缝合与母带封装]
        Node1 & Node2 & NodeN -->|切片完成| ConcatMQ[RabbitMQ: concat_tasks]
        ConcatMQ --> FFmpegStitcher[FFmpeg 无损拼接与 AAC 音频合流]
        FFmpegStitcher --> S3
        FFmpegStitcher --> FinalEvent[Event: RenderComplete]
        FinalEvent --> API_GW
    end
```

---

## 2. 关键微服务职责与数据流协议

### 2.1 音频分析微服务（Audio Processing Service）
* 运行环境与依赖：Python 3.12 容器镜像，配置 CUDA 12.4 与 PyTorch，底层挂载 `uv` 管理的 `demucs`、`mlx-whisper`、`torchaudio`、`librosa`。
* 内部处理时序：
  1. 接收 S3 音频临时凭证与歌词文本，拉取本地高速 NVMe 盘。
  2. 调用 Demucs 与 Mel-Band RoFormer 并行提取音轨与单声道主唱干声。
  3. 执行 MMS + Wav2Vec2 六轨 CTC 联合后验解算，结合 `refine()` 执行休止符与摩擦音修正，输出 `lyrics.json`。
  4. 执行多频段滤波跟随器与节拍拟合，输出 `audio.json`。
  5. 将两个 JSON 元数据传回 S3 并向事件总线发送 `AudioAnalyzed` 事件。

### 2.2 编排中枢（Orchestrator Service）
* 运行环境：轻量 Node.js (TypeScript) 或 Rust 服务端。
* 内部处理时序：
  1. 消费 `AudioAnalyzed` 事件，读取两个 JSON 数据。
  2. 调用大模型提取歌词实体意象向量与 12 维古代对偶本体极性得分（$[-1.0, 1.0]^{12}$）。
  3. 通过 gRPC 向 Qdrant 向量数据库发起余弦相似度检索，结合节拍与拍号过滤候选图元池。
  4. 若最高得分 $\ge 0.72$ 且未触发同质化熔断，选择该图元；否则向 `deficit_tasks` 投递 `AssetDeficitTicket` 并挂起当前工程。
  5. 全镜头判定通过后，编译输出 `timeline.json`。

### 2.3 分布式切片调度器与无头渲染集群（Render Pool）
* 切片无损分割算法（Chunking Algorithm）：
  1. 依据节拍网格，切片分割点必须严格对齐下拍（Downbeat）或硬切分镜边界，严禁在镜头交叉过渡（`tin`/`tout`）正中间实施物理切分。
  2. 每个切片时长规范为 15 ~ 30 秒（对应 900 ~ 1800 帧）。
* 渲染节点（Render Worker）物理架构：
  1. 基础镜像：基于 Ubuntu 22.04 LTS 配置 Chromium、Playwright、NVIDIA 专有驱动与 EGL/Metal 兼容层。
  2. 启动协议：启动本地无 HMR 私有 Vite 服务，通过 Playwright 注入 `--use-gl=angle --use-angle=gl-egl --enable-gpu-rasterization`。
  3. 数据回读：页面调用 `renderer.readRenderTargetPixelsAsync`，利用 WebGL2 PBO / Fence 双缓冲实现无停顿显存拷贝。
  4. 进程内背压：利用 Bun/Node 原生 WebSocket 将 RGBA 原始帧推入本机 FFmpeg 进程 `pipe:0`，限制滑动窗口未确认帧 $\le 4$。
  5. 产出中间件：每个节点输出一个 `chunk_X.mp4`，编码格式统一定义为 `-c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -tune grain`。

### 2.4 级联缝合与母带封装器（Stitcher Node）
* 无损级联物理实现：
  1. 当所有切片上传至 S3 后，缝合节点拉取所有分段视频。
  2. 构建 FFmpeg `concat` 列表文件：
     ```text
     file 'chunk_001.mp4'
     file 'chunk_002.mp4'
     file 'chunk_003.mp4'
     ```
  3. 执行绝对无损二进制级联，不进行二次重编码（零质量损失，耗时仅受磁盘 I/O 限制，通常 $\le 3\text{ 秒}$）：
     ```sh
     ffmpeg -y -f concat -safe 0 -i chunks.txt -i master_audio.wav -c:v copy -c:a aac -b:a 320k -shortest master.mp4
     ```

---

## 3. 标准化人机协同（HITL）资产工厂详细设计

* 隔离沙箱环境定义
  1. 每个代码生成任务分配一个独立的临时 Docker 容器（限制 CPU 2 Core，内存 4GB，无外网访问权限）。
  2. 容器内部预装 `bun`、`typescript`、`three` 及通用着色器头文件 `glsl/common.ts`。
* 自动诊断与反射修复状态机（Reflexion FSM）
  1. **状态 0 (Codegen)**：LLM 接收强约束脚手架 Prompt 生成代码，保存为 `TempScene.ts`。
  2. **状态 1 (Static Check)**：
     * 执行 `bunx tsc --noEmit TempScene.ts`。
     * 若报错，正则提取错误文件、行号与 TypeScript 诊断信息。
  3. **状态 2 (Shader AST Validation)**：
     * 抽取 TS 中所有的内联 GLSL 字符串，交由独立着色器解析器执行语法树校验。
     * 检测是否存在未声明类型、浮点/整数混用隐式转换错误。
  4. **状态 3 (Self-healing)**：
     * 若状态 1 或状态 2 失败，自愈循环计数器 $C \gets C + 1$。
     * 若 $C \le 3$，将错误日志注入 Prompt 重新发起生成；若 $C > 3$，工单标记为 `SANDBOX_FAILED`，流转至人工高级工程师介入。
  5. **状态 4 (Headless Profiling)**：
     * 编译通过，挂载至无头 Chromium 渲染 16 格接触表，并监测单帧耗时曲线。
* 人机协同工作台交互流
  1. 工程师访问 Web 工作台，系统左侧高亮展示代码 Diff 与着色器 AST，右侧展示 16 格接触表缩略图与单帧 GPU 耗时雷达图。
  2. 工作台支持实时参数热替换：修改 Uniform 变量，无头服务在 200 ms 内返回新接触表。
  3. 审查员点击 `Approve` 后，系统自动解析 TS 导出类中的 Uniform 声明，生成 `JSONSchema`，并调用文本向量模型计算标签 Embedding 写入 Qdrant 数据库。

---

## 4. 质量工程、可观测性与研发技术门禁

* CI/CD 自动化流水线技术门禁（Quality Gates）
  1. **无头截帧图像回归差分（Visual Regression Testing）**：
     * 核心渲染引擎库的代码变更（PR），必须自动触发全量 20 个内置基线场景的 60 个固定采样点无头渲染。
     * 使用像素级差分算法与基准图像进行比较：要求全图 Structural Similarity Index (SSIM) $\ge 0.995$，Peak Signal-to-Noise Ratio (PSNR) $\ge 55\text{ dB}$。若出现非预期的像素突变，直接阻断合并。
  2. **GPU 耗时与显存看门狗（Perf Watchdog）**：
     * 基准测试在统一规格的 CI GPU Worker（如 Tesla T4）上运行。
     * 任意场景模块的平均渲染耗时若超过 $16.6\text{ ms}$（1080p 单采样）或单帧显存占用超过 1.5 GB，强制打上 `PERF_REGRESSION` 标签并终止流水线。
  3. **NaN/Inf 像素污染探针**：
     * 离线渲染运行器在累加浮点渲染目标（`sumRT`）时，着色器自动扫描是否存在非有限数（NaN / Infinity）：
       ```glsl
       bool ok = abs(c.r) <= 6e4 && abs(c.g) <= 6e4 && abs(c.b) <= 6e4;
       ```
     * CI 探针捕获任何触发 `!ok` 的帧，定位发生浮点溢出的片元着色器行数。

* 生产环境监控与可观测性（Observability）
  1. **Prometheus 指标埋点**：
     * `render_frame_duration_ms`：单帧渲染物理耗时分布直方图。
     * `websocket_backpressure_stall_ms`：WebSocket 因背压暂停渲染的累计时间。
     * `asset_deficit_rate`：资产赤字工单触发率（反映预制图元池的覆盖饱和度）。
     * `hitl_review_latency_seconds`：人机资产工厂从发单到人工审核通过的周期时延。
  2. **分布式链路追踪（OpenTelemetry）**：
     * 为每个渲染任务生成全局唯一的 `TraceID`。
     * 串联：客户端上传 $\to$ 音频解构微服务 $\to$ 编排中枢 DSL 编译 $\to$ 各分布式切片渲染 Worker $\to$ FFmpeg 缝合节点，全程透明追溯。

---

## 5. 详细工程实施路线图（Milestones & Execution Plan）

```text
[阶段一: 引擎与图元解耦] ────────────────► (M1~M2)
    * 剥离硬编码歌词，建立通用 Engine 运行时
    * 完成 VisualEffectPlugin 标准接口定义与沙箱隔离规范
    * 首批 30 个参数化基础图元入库 (包含单线排版、网格地形、光线步进回廊)

[阶段二: 音频微服务与 DSL 编译] ─────────► (M3~M4)
    * Python 音频解构管线容器化封装 (Demucs + CTC + Librosa)
    * 建立 12 维二元对偶空间本体语义分析器与 Qdrant 向量检索服务
    * 实现从 audio.json + lyrics.json 到 timeline.json 的自动化编译

[阶段三: 分布式切片渲染集群] ────────────► (M5~M6)
    * 构建无头 Chromium + PBO 异步回读 + WebSocket 背压流式渲染 Worker 镜像
    * 实现 RabbitMQ 切片切分调度器与 FFmpeg 二进制无损级联 Stitcher
    * 压测达成：8 节点并发下全曲 4K60 渲染时长压缩至 5 分钟内

[阶段四: 标准化 HITL 资产工厂闭环] ──────► (M7~M8)
    * 搭建代码生成 Docker 沙箱、Reflexion 自愈循环与无头接触表压测探针
    * 上线 Web 审查控制台 (审核、调参、驳回、一键入库)
    * 实现资产赤字触发到图元入库解挂的完整生产闭环

[阶段五: 商业化上线与开放生态] ──────────► (M9~M10)
    * 完成多租户鉴权、计费计量体系与 API 网关集成
    * 开放第三方着色器工程师创作者平台与收益分成机制
    * 平台全量公测与商用交付
```

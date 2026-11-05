# 实时动态渲染与高精度音画同步系统技术规格书 (Pure Real-time AV-Sync Engine)

## 1. 目标边界与架构精简准则

* 架构收敛与战略聚焦
  1. **彻底剥离视频导出与编码链路（Zero-Export Overhead）**：
     * 移除 Playwright 无头 Chromium 驱动。
     * 移除 WebGL2 像素缓冲对象（PBO）异步显存回读与 Fence 锁。
     * 移除跨进程 WebSocket 传输与流式背压流控机制。
     * 移除 FFmpeg 编码器参数配置、libx264 封闭 GOP 及多切片二进制级联。
  2. **核心业务中枢**：
     * **浏览器视口原生 60/120 FPS 实时动态 WebGL2 渲染**。
     * **微秒级双时钟滤波音画同步引擎（Sub-frame Audio-Visual Sync）**。
     * **曲目包（Track Pack）数据驱动与插件按需动态装配**。
     * 用户仅需启动轻量前端服务（`bunx vite`），在浏览器内动态载入任意音频与歌词数据，即可实现毫秒级卡点、瞬态冲击与高保真动态视觉实时呈现。

---

## 2. 系统总体实时运行架构

```mermaid
graph TD
    subgraph Track_Pack_Layer[1. 动态曲目包规范 (Track Pack)]
        MediaFile[音频源: track.mp3 / track.wav]
        LyricsData[歌词时序: lyrics.json (词级/音节级)]
        AudioDataFile[声学特征: audio.json (BPM/包络/瞬态)]
        TimelineDSL[时间轴描述: timeline.json]
    end

    subgraph Clock_Sync_Core[2. 高精度双时钟平滑同步中枢]
        MediaFile --> AudioContext[Web Audio / HTML5 Audio 播放器]
        AudioContext --> CoarseClock[粗粒度硬件时钟: audio.currentTime]
        PerfClock[宿主单调高精时钟: performance.now] --> SmoothFilter[双时钟微分平滑滤波器]
        CoarseClock --> SmoothFilter
        SmoothFilter --> PrecisionTime[微秒级平滑时间戳: t (秒)]
    end

    subgraph Data_Bus_Dispatch[3. 时序数据总线分发]
        PrecisionTime & AudioDataFile & LyricsData --> FrameBuilder[Frame 构造器]
        FrameBuilder --> FrameObj[Frame: { t, dt, beat, beatPhase, a, lyrics }]
    end

    subgraph Scene_Graph_Runtime[4. 动态图元插件容器与合成器]
        TimelineDSL --> Dispatcher[时间轴切片调度器]
        Dispatcher --> SceneSlot1[激活插件 A: DynamicTypography]
        Dispatcher --> SceneSlot2[激活插件 B: ReactiveTerrain]
        FrameObj --> SceneSlot1 & SceneSlot2
        SceneSlot1 & SceneSlot2 --> OffscreenRT[半精度浮点 HDR 渲染目标]
        OffscreenRT --> PostPyramid[Jimenez Bloom / Tone Mapping / Film Grain]
        PostPyramid --> ScreenCanvas[原生 Canvas 视口 60/120 FPS 输出]
    end
```

---

## 3. 高精度音画同步算法实现规范（AV-Sync Algorithm）

### 3.1 双时钟微分平滑滤波器（Dual-Clock Smoothing Filter）
* 浏览器物理时钟缺陷
  1. 浏览器 `HTMLMediaElement.currentTime` 的刷新依赖声卡硬件中断，其更新频率通常极低且不均匀（Windows/Linux 约为 20~50 ms，macOS 约为 10~25 ms）。
  2. 若直接以 `audio.currentTime` 驱动 WebGL 渲染，画面在 60 Hz 刷新率下将遭遇严重的离散阶跃与卡顿（每隔几帧画面定格，随后瞬移）。
* 双时钟微分解算模型
  1. 算法利用宿主微秒级单调递增时钟 `performance.now()` 对音频粗粒度时间进行高精插值：
     ```ts
     let lastAudioT = 0;
     let lastPerfT = performance.now();
     let smoothT = 0;

     function getPreciseAudioTime(audio: HTMLAudioElement): number {
       const now = performance.now();
       // 检测声卡硬件时钟是否跳变
       if (audio.currentTime !== lastAudioT) {
         lastAudioT = audio.currentTime;
         lastPerfT = now;
       }
       // 硬件时钟跳变间隔内，利用单调宿主时钟进行线性外插
       const elapsedSinceLastTick = (now - lastPerfT) / 1000;
       smoothT = Math.min(audio.duration || Infinity, lastAudioT + elapsedSinceLastTick);
       return smoothT;
     }
     ```
  2. **漂移阻尼自愈机制（Drift Damping）**：若因系统卡顿导致外插时间与最新声卡时钟偏差超过阈值（$|\text{smoothT} - \text{audio.currentTime}| > 0.08\text{ s}$），算法立即抛弃外插值，强制软复位至音频基线，彻底消除视听累积漂移。

### 3.2 连续节拍相位插值器（Continuous Beat-Phase Interpolator）
* 节拍度量解算
  1. 依据 `data/audio.json` 预先拟合好的常量或变量节拍网格，系统在任意连续时间 $t$ 计算连续节拍索引 $\text{beat}(t)$：
     $$\text{beat}(t) = \frac{t - t_0}{60.0 / \text{BPM}}$$
  2. 提取当前节拍内的归一化相位 $\phi_{\text{beat}} \in [0.0, 1.0)$ 与小节相位 $\phi_{\text{bar}} \in [0.0, 1.0)$：
     $$\phi_{\text{beat}}(t) = \text{beat}(t) - \lfloor \text{beat}(t) \rfloor$$
     $$\phi_{\text{bar}}(t) = \text{bar}(t) - \lfloor \text{bar}(t) \rfloor$$
  3. 插件无需自行维护计时器，直接读取 $\phi_{\text{beat}}$ 即可实现与音乐律动 100% 绝对锁相的呼吸、旋转与形变。

### 3.3 100 FPS 声学特征实时求值器
* 采样插值算法
  1. `data/audio.json` 以固定 100 FPS（10 ms 间隔）存储整曲的特征序列（`rms`, `low`, `mid`, `high`, `vocal`, `drums`, `bass`, `kick`, `snare`, `hat`）。
  2. 运行时求值函数执行一阶线性插值（LERP），保证 60/120 FPS 渲染循环读取的特征值永远平滑无毛刺：
     ```ts
     sample(t: number): AudioSample {
       const idx = t * 100;
       const i0 = Math.floor(idx), i1 = Math.min(this.length - 1, i0 + 1);
       const k = idx - i0;
       return {
         kick: lerp(this.kick[i0], this.kick[i1], k),
         snare: lerp(this.snare[i0], this.snare[i1], k),
         bass: lerp(this.bass[i0], this.bass[i1], k),
         vocal: lerp(this.vocal[i0], this.vocal[i1], k),
         // ...其余字段全量插值
       };
     }
     ```

---

## 4. 数据解耦：标准曲目包（Track Pack）契约规范

为彻底解除与《P(doom)》单曲的代码耦合，平台引入标准的目录隔离契约：

* 曲目包文件系统布局
  ```text
  app/public/tracks/
  ├── default/                  # 现有 P(doom) 单曲
  │   ├── audio.mp3
  │   ├── audio.json
  │   ├── lyrics.json
  │   └── timeline.json
  └── my_new_song/              # 任意新曲目
      ├── audio.mp3
      ├── audio.json
      ├── lyrics.json
      └── timeline.json
  ```

* 动态加载机制（URL Driven & Hot Swapping）
  1. 浏览器支持通过 URL 检索参数动态指定曲目：`http://localhost:5173/?track=my_new_song`。
  2. 引擎初始化时自动拼接资源路径：
     ```ts
     const track = new URLSearchParams(location.search).get('track') || 'default';
     const basePath = `tracks/${track}`;
     const [audioData, lyrics, timelineData] = await Promise.all([
       AudioData.load(`${basePath}/audio.json`),
       Lyrics.load(`${basePath}/lyrics.json`),
       fetch(`${basePath}/timeline.json`).then(r => r.json()),
     ]);
     ```
  3. 系统彻底无需重新编译 TypeScript 代码，仅通过替换资源包即可实时播放全新曲目。

---

## 5. 首批参数化通用图元插件集（Generic Plugin Pool）

将场景逻辑从单曲语义中解放，构建首批 4 个高灵敏度、完全由外部参数驱动的通用视觉插件：

### 5.1 插件一：动态动效排版 (`DynamicTypographyPlugin`)
* 参数接口（`ctx.params`）：
  * `query`: 歌词匹配字符串（例如 `"I see sparks"`）。
  * `mode`: `'stroke_writer'`（单笔画书写） | `'engraving'`（金属排线） | `'flipboard'`（机械翻牌）。
  * `font`: 字体族名称。
  * `color`: 强调色。
* 音画同步机制：
  1. 内部调用 `this.ctx.lyrics.get(params.query)` 检索当前词条。
  2. 依据 `Lyrics.wordProgress(w, f.t)` 获取单个单词发音进度。
  3. 若为手写模式，笔尖火花精确卡在发音瞬态推进；若为翻牌模式，小军鼓瞬态（`f.a.snare > 0.5`）触发卡牌沿 X 轴翻转 180 度。

### 5.2 插件二：反应式 3D 声学地形 (`ReactiveTerrainPlugin`)
* 参数接口（`ctx.params`）：
  * `gridSize`: 网格密度（默认 60×60）。
  * `bassResponse`: 低频敏感系数（0.0 ~ 2.0）。
  * `kickShockwave`: 是否启用底鼓激波环。
* 音画同步机制：
  1. 网格顶点高度 $y(x, z, t)$ 由双重分形正弦波驱动：
     $$y(x, z, t) = \sin(x \cdot 0.2 + t) \cdot \cos(z \cdot 0.2 + t) \cdot (1.0 + f.a.\text{bass} \times \text{bassResponse})$$
  2. 底鼓瞬态（`f.a.kick`）触发同心圆高度激波向外炸开，线段颜色从基底墨色瞬间跳变为高亮发光信号橙。

### 5.3 插件三：节拍几何光线步进回廊 (`BeatTunnelSDFPlugin`)
* 参数接口（`ctx.params`）：
  * `crossSection`: 回廊截面形状（`'rect'` | `'circle'` | `'hex'`）。
  * `snapOnBar`: 是否在小节第一拍瞬态切角。
* 音画同步机制：
  1. 虚拟摄像机纵深位移严格绑定连续节拍：$z_{\text{cam}} = f.\text{beat} \times 2.0$。
  2. 小节第一拍瞬态（$\phi_{\text{bar}} < 0.05$）触发阻尼弹簧切镜（`springStep`），摄像机沿 Z 轴旋转 90 度，产生强烈的重音打击视觉冲量。

### 5.4 插件四：示波器波形与终端故障 (`OscilloscopeGlitchPlugin`)
* 参数接口（`ctx.params`）：
  * `glitchThreshold`: 故障触发阈值（默认 0.7）。
  * `scanlineDensity`: CRT 扫描线密度。
* 音画同步机制：
  1. 直接读取 100 FPS 的声学瞬态能量，当高频镲片能量 $f.a.\text{high} > \text{glitchThreshold}$ 时，片元着色器注入水平行位移噪波与色差分离（Chromatic Aberration 扩大至 6.0 px）。
  2. 等宽文本以 16 分音符节奏随机切换乱码字符，并在发音结束时收敛为稳定字符。

---

## 6. 本地开发与交互调试操作手册

* 极简本地运行工作流
  1. **安装依赖**：
     ```sh
     cd app
     bun install
     ```
  2. **启动实时交互开发服务器**：
     ```sh
     bunx vite
     ```
  3. **访问与调试**：
     * 默认曲目访问：`http://localhost:5173/`
     * 新曲目动态访问：`http://localhost:5173/?track=my_new_song`
  4. **交互控制快捷键矩阵**：
     * `Space`：播放 / 暂停音频与渲染。
     * `←` / `→`：精确时间后退 / 前进 1 秒（按住 `Shift` 为 $\pm 5$ 秒）。
     * `,` / `.`：单帧（$\pm 1/60\text{ 秒}$）高精步进（用于逐帧微调卡点）。
     * `[` / `]`：跳转至上一个 / 下一个时间轴分镜镜头。
     * `l`：循环播放当前分镜镜头（用于反复调试单个插件的音画匹配度）。
     * `h`：隐藏 / 显示调试 HUD 界面。

---

## 7. 动态渲染实施清单与代码落地点（Milestones）

* - [ ] @Task1：在 `app/public/tracks/` 下重构目录，将原有的 `audio/pdoom.mp3`、`data/audio.json`、`data/lyrics.json` 移入 `tracks/default/`，确立多曲目共存结构。
* - [ ] @Task2：重构 `app/src/main.ts` 中的 `setupPlayer()`，支持根据 URL 参数 `?track=` 动态加载目标曲目包。
* - [ ] @Task3：改造 `app/src/engine/engine.ts`，增加从 JSON 格式 DSL（`timeline.json`）动态构建 `TimelineEntry[]` 的原生支持。
* - [ ] @Task4：在 `app/src/plugins/` 下落地上演首批 4 个标准插件（`DynamicTypographyPlugin`, `ReactiveTerrainPlugin`, `BeatTunnelSDFPlugin`, `OscilloscopeGlitchPlugin`）。
* - [ ] @Task5：编写一个示例新曲目包（`tracks/demo/`），包含简化的 `timeline.json`，验证换歌后无需重写代码直接跑通 60 FPS 实时音画同步。

# 本地实时动态渲染与高精度音画同步落地实施报告

## 1. 实施目标与交付基准

本报告记录了在 Apple Silicon M3 Ultra（96GB Unified Memory）开发环境下，对 `pdoom-video` 视听生成系统的工程化解耦改造与纯实时动态渲染、音画同步体系的落地实施结果。

* 实施基准原则：
  1. 彻底剥离离线视频转码（Playwright 无头导出、PBO 异步回读、WebSocket 背压与 FFmpeg 编码拼接均已移出主路径）。
  2. 专注浏览器 Canvas 视口内的纯实时渲染（60/120 FPS），实现“曲目数据包外置化驱动”与“通用特效插件化调度”。
  3. 保留原有微秒级双时钟平滑插值算法，确保歌词发音进度、节拍相位与视觉特效的毫秒级硬对齐。

---

## 2. 系统解耦与工程化重构全景

```
+-----------------------------------------------------------------------------------+
|                              Web 视口 (Browser Canvas)                             |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                        Dual-Clock Synchronizer (双时钟平滑)                  |  |
|  |  HTMLMediaElement (粗粒度 10~25ms) + performance.now() (微秒级线性插值)        |  |
|  +--------------------------------------+--------------------------------------+  |
|                                         |                                         |
|                                         v (实时时间戳 t, dt)                       |
|  +-----------------------------------------------------------------------------+  |
|  |                     Engine Core (引擎核心 & 状态路由器)                      |  |
|  |                     - AudioFeatureContext (RMS/Kick/Bass/Centroid)          |  |
|  |                     - PhonemeProgressContext (音素级发音插值)                |  |
|  |                     - Multi-Layer Scene Dispatcher (分层场景调度)            |  |
|  +----+--------------------------------+---------------------------------+-----+  |
|       |                                |                                 |        |
|       v                                v                                 v        |
|  +----+---------+              +-------+--------+              +---------+-----+  |
|  |  Background  |              |   Foreground   |              |    Overlay    |  |
|  |    Layer     |              |     Layer      |              |     Layer     |  |
|  | (Terrain 3D/ |              |  (Typography/  |              | (Glitch CRT/  |  |
|  |  Tunnel 3D)  |              | Dynamic Fonts) |              | Sine Scopes)  |  |
|  +--------------+              +----------------+              +---------------+  |
+-----------------------------------------------------------------------------------+
                                         ^
                                         | 动态加载与参数注入
+----------------------------------------+------------------------------------------+
|                  External Track Data Assets (外置曲目包目录)                      |
|                                                                                   |
|  tracks/${track}/                                                                 |
|  ├── audio.mp3          (立体声音频源文件)                                        |
|  ├── audio.json         (离线提取的节奏节拍、RMS 能量与低中高频段特征序列)         |
|  ├── lyrics.json        (强制对齐的逐词/逐音素时间戳数据)                         |
|  └── timeline.json      (基于纯 JSON DSL 描述的分镜镜头排期与插件参数)             |
+-----------------------------------------------------------------------------------+
```

---

## 3. 核心改造模块与源码落地细节

### 3.1 动态时间轴加载器与插件运行时调度器
* 模块路径：[`app/src/engine/timeline-loader.ts`](file:///Users/ic/Copyright/pdoom-video/app/src/engine/timeline-loader.ts)
* 技术职责：
  1. 使用 Vite 的 `import.meta.glob` 扫描 `src/scenes/*.ts` 与 `src/plugins/*.ts` 两个目录，构建统一的特效场景工厂映射表。
  2. 支持直接解析 `timeline.json` 数据结构，将 DSL 配置的 `start`, `end`, `layer`, `params` 转换为引擎可执行的分镜实体。
  3. 支持分层图层调度与动态参数浅合并注入。

### 3.2 动态多曲目外置化数据加载
* 模块路径：
  * [`app/src/engine/audio.ts`](file:///Users/ic/Copyright/pdoom-video/app/src/engine/audio.ts)
  * [`app/src/engine/lyrics.ts`](file:///Users/ic/Copyright/pdoom-video/app/src/engine/lyrics.ts)
  * [`app/src/engine/engine.ts`](file:///Users/ic/Copyright/pdoom-video/app/src/engine/engine.ts)
  * [`app/src/main.ts`](file:///Users/ic/Copyright/pdoom-video/app/src/main.ts)
* 技术职责：
  1. `AudioFeatures.load(url?: string)` 与 `Lyrics.load(url?: string)` 支持传入自定义 URL，兼容从 `tracks/${track}/audio.json` 加载任意曲目数据。
  2. `main.ts` 解析 URL Query 参数 `?track=demo`，自动定位曲目包目录并按需挂载。
  3. 在未指定 `?track=` 时无缝回退至原版 `scenes/` 内置全套时间轴，实现 100% 向后兼容。

### 3.3 首批四类标准化通用插件实现
所有插件均遵循统一的 `Scene` 接口规范，存放于 [`app/src/plugins/`](file:///Users/ic/Copyright/pdoom-video/app/src/plugins/)：

* 1. 动态动效排版插件 [`typography.ts`](file:///Users/ic/Copyright/pdoom-video/app/src/plugins/typography.ts)：
  * 特性：利用 `opentype.js` 解析字形轮廓，结合当前播放时间戳 `t` 与强制对齐音素进度 `writtenLength`，实现字模的微秒级动态书写高亮与模糊拖尾。
  * 参数：`fontSize`（字号）、`glow`（辉光强度）、`lineHeight`（行高）。
* 2. 反应式透视网格地形插件 [`terrain.ts`](file:///Users/ic/Copyright/pdoom-video/app/src/plugins/terrain.ts)：
  * 特性：基于 WebGL 连续动态网格与三维正交投影，实时绑定音频 `audio.bassAt(t)` 振幅调制与小节下拍（Kick）激波环扩散，展现赛博朋克线框地形。
  * 参数：`gridSize`（网格细分密度）、`spacing`（线条间距）、`cameraZ`（视距）、`peakHeight`（振幅抬升系数）。
* 3. 几何回廊光线步进插件 [`tunnel.ts`](file:///Users/ic/Copyright/pdoom-video/app/src/plugins/tunnel.ts)：
  * 特性：构建无限延展的多边形管道，相机沿 Z 轴快速推进，管道旋转角速度受音频强拍能量冲击产生瞬态角加速度阻尼回弹。
  * 参数：`segments`（环段数量）、`tunnelRadius`（管道半径）、`cameraSpeed`（推镜基准速度）、`rotationImpulse`（节拍冲击力度）。
* 4. 示波器与 CRT 终端故障插件 [`glitch.ts`](file:///Users/ic/Copyright/pdoom-video/app/src/plugins/glitch.ts)：
  * 特性：叠加全屏动态扫描线、RGB 色散故障抖动（Chromatic Aberration）与随音频高频段（Centroid）跳变的示波器正弦波形。
  * 参数：`waveColor`（波形三原色 RGB）、`scanlineAlpha`（扫描线透明度）、`noiseIntensity`（噪波强度）。

---

## 4. 自动化端到端实测验证与性能指标

通过基于 `playwright-core` 的无头 GPU 实例（调用 Google Chrome for Testing，启用 Metal/ANGLE 硬件加速）执行全量回归与动态加载测试：

### 4.1 测试执行结果汇总表

| 测试用例目标 | 访问路由 | 引擎初始化状态 | 运行时平均帧率 | 音画同步指标实测 | 异常与崩溃检测 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 原生内置时间轴全回归 | `http://localhost:5174/` | 成功加载 28 个内置场景 | 60 FPS (恒定) | `t=2.93s, beat=5.92, bar=1.48, scene=[open]` | 零运行时报错 (0 fatal error) |
| 模块化插件 DSL 动态驱动 | `http://localhost:5174/?track=demo` | 成功编译 4 个动态插件并挂载 DSL | 60 FPS (恒定) | `t=2.95s, beat=5.96, bar=1.49, scene=[entry_0_terrain]` | 零运行时报错 (0 fatal error) |
| 多图层复合时间点 T1 | `http://localhost:5174/?track=demo&t=12` | Terrain + Typography 双图层融合 | 60 FPS (恒定) | `t=12.00s, beat=25.88, bar=6.47, lyrics=“There was a sudden drop in your training loss,”` | 正常渲染，字形按音素渐次写入 |
| 多图层复合时间点 T2 | `http://localhost:5174/?track=demo&t=32` | Tunnel + Glitch + Typography 复合 | 60 FPS (恒定) | `t=32.00s, beat=69.88, bar=17.47, lyrics=“See through the shoggoth’s lies,”` | 正常渲染，故障扫描与管道回廊复合 |

### 4.2 渲染截图存根
实测截图均已落盘保存在 `素材/` 目录：
* [`render_test_default.png`](file:///Users/ic/Copyright/pdoom-video/%E7%B4%A0%E6%9D%90/render_test_default.png)：原版曲目开场实时渲染画面。
* [`render_test_demo.png`](file:///Users/ic/Copyright/pdoom-video/%E7%B4%A0%E6%9D%90/render_test_demo.png)：通用插件数据驱动开场渲染画面。
* [`render_demo_t12_typography_terrain.png`](file:///Users/ic/Copyright/pdoom-video/%E7%B4%A0%E6%9D%90/render_demo_t12_typography_terrain.png)：动态地形网格与发音进度动态排版文字叠加画面。
* [`render_demo_t32_tunnel_typography.png`](file:///Users/ic/Copyright/pdoom-video/%E7%B4%A0%E6%9D%90/render_demo_t32_tunnel_typography.png)：3D 光线几何回廊与 CRT 示波器故障扫描线复合画面。

---

## 5. 本地运行与实时交互操作手册

### 5.1 服务启动命令
在终端执行下列命令进入开发调试环境：
```bash
cd /Users/ic/Copyright/pdoom-video/app
bunx vite --port 5174
```

### 5.2 浏览器访问地址与曲目选择
* 访问原版内置时间轴：
  `http://localhost:5174/`
* 访问外置通用插件 DSL 编排曲目（demo）：
  `http://localhost:5174/?track=demo`
* 定位至特定时间戳（例如第 15.5 秒）：
  `http://localhost:5174/?track=demo&t=15.5`

### 5.3 交互快捷键定义
* `空格键 (Space)`：播放 / 暂停音频与动态渲染。
* `方向键左 / 右 (← / →)`：后退 / 前进 1 秒（按住 `Shift` 为 5 秒）。
* `逗号 / 句号 (, / .)`：单帧逐帧后退 / 前进（步长精确为 1/60 秒）。
* `按键 L (l)`：单曲片段循环（Loop）当前镜头分镜区间。
* `按键 [ / ]`：快速跳跃到上一个 / 下一个分镜镜头。
* `按键 H (h)`：隐藏 / 显示顶部时间轴与状态指示 UI。

---

## 6. 新曲目接入与特效插件扩展 SOP

### 6.1 新增曲目流程
* 1. 在 `app/public/tracks/` 下新建曲目文件夹，例如 `app/public/tracks/my-song/`。
* 2. 放入 `audio.mp3`（音频）、`audio.json`（特征数据）与 `lyrics.json`（音素歌词数据）。
* 3. 编写 `timeline.json`，配置分镜镜头排期与插件参数：
  ```json
  [
    {
      "scene": "terrain",
      "start": 0.0,
      "end": 20.0,
      "layer": "background",
      "params": { "peakHeight": 8.0 }
    },
    {
      "scene": "typography",
      "start": 0.0,
      "end": 20.0,
      "layer": "foreground",
      "params": { "fontSize": 60 }
    }
  ]
  ```
* 4. 浏览器直接访问 `http://localhost:5174/?track=my-song`，无需重启服务或重新打包。

### 6.2 新增特效插件流程
* 1. 在 `app/src/plugins/` 下新建 TypeScript 文件（例如 `my-fx.ts`）。
* 2. 导出符合 `Scene` 接口的类，实现 `render(gl, t, dt, audio, lyrics, font)` 逻辑。
* 3. 动态加载器 `timeline-loader.ts` 会自动扫描并在 `timeline.json` 中以 `"scene": "my-fx"` 识别调用。

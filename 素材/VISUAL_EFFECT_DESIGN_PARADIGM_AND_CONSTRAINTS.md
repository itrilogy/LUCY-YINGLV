# 视效设计范式与强约束规范 (Visual Effect Design Paradigm & Hard Constraints Specification)

* 规范背景与物理事实定性
  1. 在基于着色器（Shader / Raymarching）与 2D/3D 动态图元的音乐视频生成系统中，视觉效果器（Visual Effect Plug-ins）不仅承担艺术渲染职责，更是承载文字传达与音乐节奏共振的信息介质。
  2. 既往工程中出现“`entry 13-14` 过渡时视效白色严重遮盖歌词”、“局部光晕 Bloom 爆炸吞噬字形”等缺陷，本质上是缺乏**光照动力学上界约束**与**文字安全视域对比度屏障**。
  3. 为确保后续所有视效（无论是人工编写还是大模型自动化生成）均具备统一、高品质、高可读性、高工业美感的渲染输出，特确立本强约束规范体系。所有进入效果器仓库的代码必须强制通过本规范的几何与光学静态审计。

* 核心强约束准则 (The Five Inviolable Hard Constraints)
  1. **照度上限与反差守恒约束 (Luminance Ceiling & Contrast Conservation)**：
     * **文本中心视域定义**：画面中心矩形区域：
       $$\mathcal{Z}_{\text{safe}} = \{ (x, y) \mid 0.20 \cdot W \le x \le 0.80 \cdot W, \; 0.35 \cdot H \le y \le 0.65 \cdot H \}$$
       被定义为绝对文字安全视域（Text Safe Zone）。
     * **背景平均照度上限**：在 $\mathcal{Z}_{\text{safe}}$ 内，背景片元着色器计算出的平均感知亮度（Perceived Luminance $L_{\text{avg}} = 0.2126R + 0.7152G + 0.0722B$）不得超过 $0.40$。
     * **峰值 HDR 能量截断**：严禁在 $\mathcal{Z}_{\text{safe}}$ 内部输出超过 $1.2$ 的未衰减 HDR 高光数值，防止经过 Jimenez Bloom 金字塔多级下采样与双三次上采样滤镜后，高斯卷积核扩散形成连片纯白光斑。
     * **安全反差护盾强制挂载**：所有文字图层必须强制由内核自动挂载径向对比度衰减护盾（Radial Text Safe Scrim）。即使背景存在极端亮度波动，护盾中心提供不低于 $0.80$ 不透明度的深色吸光核，确保前景色与背景色对比度恒大于等于 $4.5:1$（满足 WCAG AAA 级视认标准）。
  2. **转场闪光衰减定理 (Transition Flash Decay Theorem)**：
     * 在镜头时间轴分界点 $t_{\text{cut}}$ 邻域内：
       - 分镜最后 $0.20\text{s}$（$\text{tout} > 0.80$）必须强制衰减全屏后处理闪白（$\text{flash} \to 0$）。
       - 分镜初始 $0.15\text{s}$（$\text{tin} < 0.15$）禁止产生大面积纯白首帧冲击。
     * 避免因前一分镜的残留高光与后一分镜的初始高光在时间轴交割处发生双重能量叠爆（Double Energy Overexposure）。
  3. **景深灭点雾效遮蔽约束 (Horizon & Vanishing Point Depth Occlusion)**：
     * 对于所有透视隧道（Tunnel）、网格走廊（Corridor）、天梯（Ascent）等具有三维灭点（Vanishing Point）的着色器插件：
     * 必须在灭点视心应用指数级或平滑步进距离衰减：
       $$\text{Color}(p) = \text{Color}(p) \cdot \text{smoothstep}(r_{\text{inner}}, r_{\text{outer}}, \|p - p_{\text{center}}\|)$$
     * 严禁让光线步进发光图元在视口中央灭点处发生算术叠加汇聚，造成中心“白洞”遮挡歌词排版。
  4. **严格接壤与零重叠公理 (Strict Adjacency & Zero Ghost Overlap)**：
     * 分镜排程必须严格满足：
       $$t_{\text{end}}^{(i)} \equiv t_{\text{start}}^{(i+1)}$$
     * 严禁非显式声明的重叠区间。引擎在调用任一场景的 `render()` 前，必须强制执行显存清屏屏障：
       $$\text{clearRT}(\text{renderer}, \text{rt}, [0, 0, 0], 1.0)$$
     * 杜绝上一分镜在显存帧缓冲区（`WebGLRenderTarget`）中残留任何几何线段或文字图元的鬼影。
  5. **动效运动形式与视觉动量守恒 (Dynamic Motion Forms & Momentum Conservation)**：
     * 严禁呆板无动能的单一行静态居中文本。文字的切入、演唱与退出必须具有明确的物理运动学形式：
       - **弹性机械冲压式 (Kinetic Punch)**：适合下拍底鼓（Kick），伴随阻尼弹簧回弹（Damped Spring Overshoot $\omega = 18, \zeta = 0.65$）。
       - **终端流式打字式 (Cyber Stream)**：适合高密度叙事与前奏，光标以固定时钟节拍闪烁推进，字符乱码解构重组。
       - **时空轨道拉伸式 (Orbital Warp)**：适合长音与氛围副歌，文字沿引力场法线产生微弧度弯曲与浮动。
       - **多句流式轮播 (Fluid Carousel)**：多句歌词在同一分镜内平滑滚屏切换，无声期文本自动淡出降为 0，严禁文字僵死常驻。

* 视觉效果器标准化接口规约 (Standard Visual Effect Interface)
  1. **输入数据契约 (The Input Frame Bus)**：
     * `f.t`：全局时间（秒，高精度浮点）。
     * `f.dt`：标称帧间隔时间（$1/60\text{s}$）。
     * `f.beat`：当前拍点位置（如 $14.25$）。
     * `f.barPhase`：当前小节内相位 $[0, 1)$。
     * `f.a`：实时声学能量包（`kick`, `snare`, `hat`, `bass`, `high`, `rms`）。
     * `f.tin`：入场进度 $[0, 1]$（从 0 上升到 1）。
     * `f.tout`：退场进度 $[0, 1]$（临近结束从 0 上升到 1）。
  2. **歌词嵌入调用范式**：
     * 视效内部统一通过 `BespokeSceneHelper.getRenderableLyric(this.lines, f.t)` 获取当前歌词状态。
     * 统一调用 `BespokeSceneHelper.renderEmbeddedLyric(ctx2d, lyric, f, options)` 渲染高质量字形。
     * 视效代码无需关注字体加载、词间断句、卡拉OK进度计算，所有排版完全解耦并符合安全视域护盾规范。
  3. **输出后处理覆盖 (PostOverrides)**：
     * `bloom`：发光强度（基线 $0.4 \sim 0.7$，底鼓峰值不得超过 $1.0$）。
     * `ca`：色散偏移（Chromatic Aberration，基线 $1.0 \sim 1.5$，瞬态不得超过 $5.0$）。
     * `zoom`：摄像机冲击微缩放（基线 $1.0$，底鼓峰值不得超过 $1.05$）。
     * `shake`：二维高频震颤向量 $[dx, dy]$（不得超过 $\pm 4\text{px}$）。
     * `flash`：全屏闪白增益（必须在分镜末尾衰减至 $0.0$）。

* 大模型代码生成提示词范式 (LLM Prompt Generation Template)
  1. 为大模型（如 Claude 3.7 / DeepSeek V3）生成新视觉效果器插件时，必须在 Prompt 前置注入以下强约束上下文：
     ```text
     You are writing a TypeScript Visual Effect Plugin for a deterministic WebGL music video player.
     Class must extend Scene from '../engine/scene.ts'.
     Rules:
     1. LUMINANCE CAP: Keep central region (UV around 0, 0) darkened (smoothstep attenuation) so text is clearly visible. Do NOT output raw white (clamp to 1.2 max before bloom).
     2. LYRIC INTEGRATION: Use BespokeSceneHelper.resolveLines(this.ctx) in init(), and in render() call BespokeSceneHelper.getRenderableLyric and BespokeSceneHelper.renderEmbeddedLyric.
     3. RHYTHM REACTIVITY: Modulate uniforms using f.beat, f.barPhase, f.a.kick, f.a.snare, f.a.bass.
     4. NO OVERLAY: Everything must be drawn into the provided out: WebGLRenderTarget using FSPass and Layer2D comp.
     5. FLASH DECAY: Decay postOverrides.flash to 0 when f.tout > 0.5.
     ```

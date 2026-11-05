# 镜头语言五层正交动态拼装、节奏动力学参数总线与资源三位一体管理详细设计文档
# (Layered Lens Language, Beat Dynamics Bus, Trilogy Resource Mapping & Effect Management Spec)

* 文档定位与工程基准
  1. 本文档为 `pdoom-video` 项目镜头语言重构、渲染管线正交分层、节奏参数解耦、三位一体资源映射及新视效全生命周期管理系统的核心详细设计文档 (Detailed Design Document / Architecture Design Document)。
  2. 针对原有分镜“单体插件单一硬编码、镜头表达单调、背景与文字强耦合、视效难以复用”的根本缺陷，建立基于现代计算机图形学分层合成理论（Multi-Pass Compositing）与物理声学驱动的全新工业级架构。
  3. 全文基于 Apple Silicon M3 Ultra（96GB UMA）原生 Metal/ANGLE WebGL 硬件加速与确定性双时钟架构展开，严禁任何形式的摘要、占位符或逻辑删减。

* 原版镜头感提炼与核心意象【表达物】抽象
  1. 原版项目视听镜头语言的本质不是纯粹的代码特效，而是哲学隐喻与工业巨构的具象化视听符号。在原版 28 个镜头中，抽取出 10 大核心镜头意象（Motif Entities）：
     * 硅晶圆单晶阵列与 EUV 光刻扫描带（Micro Silicon Lithography）：表达微观纳米晶体管到机架宏观算力网络的跨尺度拓扑跃迁。
     * 广义相对论时空曲率与爱因斯坦引力透镜（Schwarzschild Event Horizon）：表达奇点降临带来的信息视界扭曲与不可逆引力吸积。
     * 官僚机构审批双边框与红色重击印章（Bureaucratic Red Tape & Stamp）：表达算力配额配给、禁令红线与体制冷酷约束。
     * 战术急剧左转抛物线与安全甘特图（Sharp Left Turn & Safety Gantt）：表达智能体避障机动、风险阻抗临界与断臂求生排程。
     * 高维异质触手与伪装笑脸面具（Shoggoth Tentacle & Mask）：表达技术本体的不可名状异质性与表面人工对齐的脆弱二元对立。
     * 回形针三维晶格无限自我增殖（Infinite Paperclips Lattice）：表达功利最大化盲目目标的无限制资源吞噬。
     * 算力天梯机械滚轮里程表（Ascent FLOPs Odometer）：表达模型参数与算力以十进制、千进制机械暴力的指数飙升。
     * 十万级 H100 GPU 机架透视长廊与 LED 阵列（Dense Compute Cluster）：表达数据中心百兆瓦电力消耗与高密度算力物理沉淀。
     * 动态引信燃烧火花轨迹（Fuse Sparkline）：表达不可逆的时间紧迫性与倒计时临界危机。
     * 高维张量注意力交织网络（Tensor Network Loom）：表达 Transformer 多头自注意力权重的动态编织。
  2. 原版镜头的致命缺陷在于将上述意象、背景、点缀与歌词排版写死在单一的 `Scene` 文件中，导致镜头语言无法根据音乐情绪自由重组。必须彻底解耦为正交的独立图层。

* 视效设计范式五大正交图层系统 (The 5-Pass Layer System)
  1. **Pass 0: 背景视效层 (Background Pass)**
     * 职责：构建整个三维空间的物理基底、灭点景深与环境光基调。
     * 渲染特征：全屏铺底，写入颜色缓冲与深度缓冲（或充当第一道全屏着色器 pass）；严格限制中央视域照度（$L_{\text{HDR}} \le 0.35$），严禁产生大面积纯白刺眼光斑。
     * 典型插件：`terrain`（网格地平线）、`room-terminal`（四屏闭路监控机房）、`tunnel`（3D 光线步进几何回廊）、`glitch`（暗黑示波器底材）。
  2. **Pass 1: 意象物层 (Imagery / Motif Entity Pass)**
     * 职责：承载当前分镜的核心叙事表达物，充当镜头画面中的视觉焦点与物理实体。
     * 渲染特征：具有三维形态、空间坐标、几何曲率或拓扑网络，采用半透或正常混合（`normal` / `blend`）叠合在背景层上方；必须执行文字视域护盾（`Text Safe Scrim`），在画面中央自动留出吸光核（$r \in [0.2, 0.7]$），确保文字不被主体几何结构遮挡。
     * 典型插件：`hardware-stack`（硅晶圆）、`gantt-maneuver`（机动抛物线）、`bureau-stamps`（公文印章）、`cyber-shoggoth`（修格斯）、`spacetime-lens`（引力透镜）、`infinite-clips`（回形针）、`ascent-odometer`（算力表）、`dense-cluster`（机架集群）、`matrix-loom`（多维织机）。
  3. **Pass 2: 点缀线条视效层 (Accent / Line Geometry Pass)**
     * 职责：为画面注入高频瞬态细节、测距标尺、激光光斑、故障扫描与动态生命力。
     * 渲染特征：采用加色混合（`add`）或滤色混合（`screen`）叠合在上层，直接在已有画面上增光增色；不遮挡下层任何像素，随音乐高频音素（如踩镲、军鼓、白噪声）激发。
     * 典型插件：`acoustic-loss`（声学通量折线散点）、`fuse-spark`（引信火花粒子）、`glitch`（李萨如图形与色散横扫）。
  4. **Pass 3: 字效层 (Typography Pass)**
     * 职责：自洽呈现歌词文本、微秒级单字发音推进、卡拉OK高亮、副歌大标题冲击与机械字模挤压。
     * 渲染特征：永远置于最顶层（`layerIndex: 3`），采用正常混合（`normal`）；文字轮廓必须携带 $1.0\times$ 紧密黑色描边，前背景对比度恒满足 $\ge 4.5:1$（WCAG AAA 级可读性）；发音期间高亮发光，无人声期间彻底消隐（透明度严格归零）。
     * 典型插件：`kinetic-press`（机械冲压字模）、`cyber-prompt`（黑客打字流）、`kinetic-hook`（副歌大标题激波环）、`typography`（多句轮播排版）。
  5. **Pass 4: 颜色/调色情绪层 (Color Grade & Mood Pass)**
     * 职责：定义全局色温、曝光、反差、光晕泛滥（Bloom）、胶片噪点与情绪氛围，使前四层在统一的电影级色调中融为一体。
     * 渲染特征：作用于全屏后处理阶段（`PostParams`），通过色调曲线与矩阵变换塑造主观情绪表达。
     * 五大官方调色预设（Color Grade Moods）：
       * `cold-industrial`（冷调工业）：冷蓝灰低饱和、高暗部反差、机械严谨，适用于工程技术叙事。
       * `warning-crimson`（告警赤红）：高饱和深红泛滥、重度暗角、强烈危机感，适用于急剧左转与修格斯暴露。
       * `cyber-green`（赛博黑客绿）：荧光绿扫描线、CRT 暗夜微光，适用于黑客终端打字流与矩阵运算。
       * `void-monochrome`（空无单色）：超高反差纯黑白、粗胶片颗粒，适用于纯器乐高潮与虚无尾奏。
       * `noir-gold`（新黑色金）：暗金辉光、典雅复古胶片感，适用于时空引力与宏大叙事。

* 节奏点与声学动力学参数总线 (Beat Dynamics Bus) 模型
  1. 为使五大图层均能感知物理声学能量并产生协同律动，扩展了引擎的核心 `Frame` 接口，形成标准化的参数总线：
     * `f.t`：全局绝对歌曲时间（秒，64位浮点）。
     * `f.lt`：当前分镜内的局部相对时间（$t - t_{\text{start}}$）。
     * `f.p`：当前分镜生命周期进度（$\tau = \frac{t - t_{\text{start}}}{t_{\text{end}} - t_{\text{start}}} \in [0, 1]$）。
     * `f.beat`：连续拍点计数（来自音频分析总线）。
     * `f.barPhase`：当前小节内连续相位（$\phi_{\text{bar}} \in [0, 1)$），用于驱动背景与网格的循环旋转。
     * `f.beatPhase`：当前拍内连续相位（$\phi_{\text{beat}} \in [0, 1)$），用于驱动字模微震与卡拉OK推进。
     * `f.downbeat`：下拍瞬态冲量（$e^{-\min(1, \phi_{\text{bar}} \cdot 16) \cdot 4} \in [0, 1]$），在每个小节的第一拍瞬间激发为 1.0 并以指数规律衰减，用于驱动重压、闪光与视角推拉。
     * `f.kickImpulse`：底鼓物理撞击冲量（$a_{\text{kick}} \in [0, 1]$），用于驱动意象物形变与缩放。
     * `f.snareImpulse`：军鼓高频通量冲量（$a_{\text{snare}} \in [0, 1]$），用于激发粒子飞溅与色散横扫。
     * `f.hatImpulse`：踩镲十六分音符脉冲（$a_{\text{hat}} \in [0, 1]$），用于驱动指示灯矩阵与光纤信号。
     * `f.energy`：多频段综合归一化 RMS 能量（$\min(1, 1.5 a_{\text{rms}} + 0.8 a_{\text{low}} + 0.5 a_{\text{high}})$），用于控制全局呼吸幅度与景深扰动。
     * `f.tin` / `f.tout`：当前镜头出入场交叠平滑因子（$[0, 1]$），用于控制闪光消隐与进出场平滑插值。
     * `f.layerIndex`：当前所处图层角色索引（0: 背景, 1: 意象, 2: 线条, 3: 字效）。
  2. 各图层对节奏参数的分工响应矩阵：
     * 背景层：锁定 `f.barPhase`（低频稳定漂移）与 `f.energy`（地平线波浪起伏）。
     * 意象物层：锁定 `f.downbeat`（小节起拍瞬间形变）与 `f.kickImpulse`（物理刚体弹簧振荡）。
     * 点缀线条层：锁定 `f.snareImpulse` 与 `f.hatImpulse`（高频瞬态火花爆发与色散脉冲）。
     * 字效层：锁定 `f.beatPhase` 与 CTC 微秒时间戳（单词逐字发音推进与卡拉OK高亮）。
     * 调色层：锁定 `f.downbeat` 与 `f.tout`（微弱曝光呼吸与镜头切换瞬态暗部压缩）。

* 镜头语言动态拼装与数学合成算子
  1. **严格接壤公理 (Strict Adjacency Invariant)**：
     * 相邻分镜必须满足时间轴零重叠接壤：
       $$t_{\text{end}}^{(i)} \equiv t_{\text{start}}^{(i+1)}$$
     * 彻底消除了镜头跨越导致的视效堆叠重影问题。
  2. **图层正交复合算子 (Orthogonal Composition Operator $\mathcal{C}$)**：
     * 设第 $i$ 幕分镜由四层图像和一层调色构成，合成算子定义为：
       $$I_{\text{comp}} = \text{Grade}\left( I_{\text{bg}} \underset{\text{normal}}{\oplus} I_{\text{img}} \underset{\text{screen}}{\oplus} I_{\text{acc}} \underset{\text{normal}}{\oplus} I_{\text{typo}}, \;\text{LUT}\right)$$
     * 在 WebGL 渲染管线中，引擎按 `layerIndex` 升序依次渲染至内部 `RenderTarget`：
       * Layer 0 (Background)：以 `mode: 'replace'` 写入底材，清除历史显存脏数据。
       * Layer 1 (Imagery)：以 `mode: 'normal'` 叠加到背景之上，保留空间景深。
       * Layer 2 (Accent)：以 `mode: 'screen'` 执行滤色增色，保持暗部通透。
       * Layer 3 (Typography)：以 `mode: 'normal'` 携带描边覆盖在最顶层，确保文字绝对清晰。
       * Layer 4 (Color Grade)：覆盖后处理参数 `PostParams`，实施色调映射与全局辉光。
  3. **组合爆炸效用模型**：
     * 系统拥有 4 款背景基底、9 款主体意象物、3 款点缀线条、4 款字效排版与 5 种情绪调色。
     * 正交解耦后，可生成的独立电影级分镜总数达到：
       $$N = 4 \times 9 \times 3 \times 4 \times 5 = 2160 \text{ 种独立视听镜头}$$
     * 相比原有单一场景硬编码，表现力与复杂度呈现超百倍的几何级飞跃。

* 现有 19 款视效的复用、改造与扩充评估表
  1. 插件图层角色分类表：
     * `terrain`：【背景层】开场网格地平线视差，参数化高斯波浪。
     * `room-terminal`：【背景层】全息 4 屏监控机房，暗黑控制室视界。
     * `tunnel`：【背景层】光线步进 3D 几何管道，极速几何穿梭。
     * `glitch`：【点缀层/背景】CRT 示波器李萨如图形，RGB 色散故障。
     * `hardware-stack`：【意象物层】300mm 硅晶圆单晶阵列、EUV 步进光刻与硬件架构拓扑。
     * `gantt-maneuver`：【意象物层】战术左转机动抛物线、风险阻抗带与安全甘特图排程。
     * `bureau-stamps`：【意象物层】官僚行政公文双边框、复印机蓝白光带与红色撞击印章。
     * `cyber-shoggoth`：【意象物层】高维触手空间波动、笑脸面具与死神之眼目标检测框。
     * `spacetime-lens`：【意象物层】爱因斯坦黑洞引力透镜弯曲与吸积盘测地线。
     * `infinite-clips`：【意象物层】回形针三维空间晶格无限自我增殖网络。
     * `ascent-odometer`：【意象物层】算力天梯与 FLOPs 指数飙升机械滚轮。
     * `dense-cluster`：【意象物层】十万级 H100 GPU 机柜透视长廊与 LED 阵列。
     * `matrix-loom`：【意象物层】多维张量网络织机与动态注意力连线。
     * `acoustic-loss`：【点缀层】实时音频通量折线图谱与激光散点火花。
     * `fuse-spark`：【点缀层】燃烧引信粒子物理轨迹与实时旋律音高吸附。
     * `kinetic-press`：【字效层】重型工业机床液压冲压字模排版。
     * `cyber-prompt`：【字效层】黑客终端流式逐字打字机与光标时钟。
     * `kinetic-hook`：【字效层】副歌大标题冲击、同心圆激波环与红蓝故障色散。
     * `typography`：【字效层】流式卡拉OK连续多句轮播排版。
  2. 扩展新视效的标准 SOP（五步法）：
     * 步骤 1：明确图层角色定位（必须归属于背景、意象、点缀、字效中的一种）。
     * 步骤 2：继承 `Scene` 基类，接入 `Frame` 扩展节奏参数总线。
     * 步骤 3：注入文字视域护盾（`Text Safe Scrim`）与照度上限约束（$L_{\text{HDR}} \le 1.4$）。
     * 步骤 4：在独立沙箱中进行 60 FPS 满帧回归测试与内存泄漏核验。
     * 步骤 5：在 `tag-system.ts` 注册元数据（流派、意象、声学偏好、图层角色），自动进入工作台候选集。

* 歌曲、歌词、编排时序三位一体资源映射架构
  1. **曲目包规范文件系统布局 (Track Package Layout)**：
     ```text
     public/tracks/<track_id>/
     ├── audio.mp3          # 原始音频音频总线（44.1kHz, 16-bit）
     ├── audio.json         # 100 FPS 离线声学特征包（beats, downbeats, features, onsets）
     ├── lyrics.lrc         # 标注文档词本（含行文本）
     ├── lyrics.json        # CTC 微秒级单字物理时间戳与对齐向量（227 词级分布）
     ├── timeline.json      # 分层分镜 DSL 调度排程（16 幕严格接壤排程）
     └── tags.json          # 意象与美学流派元数据配置
     ```
  2. **三位一体映射一致性约束矩阵**：
     * **时间域守恒**：$T_{\text{timeline}} \equiv T_{\text{lyrics}} \equiv T_{\text{audio}}$。编排文件的终点 $t_{\text{end}}^{(\text{last})}$ 必须严格等于音频文件的持续时长 $T_{\text{audio}}$。
     * **下拍对齐吸附**：每一个分镜的切分时间点 $t_{\text{start}}^{(i)}$ 必须吸附在音频特征分析导出的最近下拍网格（Downbeats Grid $\mathcal{Q}_\mathcal{B}$）上，消除视觉硬切脱节。
     * **人声与文字锁相**：字效层的发音推进参数 $p(W, t)$ 必须严格由 `lyrics.json` 中的单字微秒起止区间 $[W.\text{start}, W.\text{end}]$ 线性插值驱动，人声静默期字效层自动消隐。
  3. **工作台可管理性集成**：
     * 在工作台【02 歌曲加工】面板中，直观渲染“三位一体拓扑架构卡片 (Trilogy Topology Card)”，展示三大资源的实时参数、状态机指示灯与一键校验同步按钮。

* 新视效全生命周期管理架构 (Effect Management Lifecycle)
  1. **导入管理 (Import Lifecycle)**：
     * 工作台支持用户一键输入外部插件 ID、中文名称、图层角色定位与 TypeScript / GLSL 源码。
     * 客户端通过 WebGL 动态沙箱执行快速预编译，验证语法完整性后动态载入 `PLUGIN_REGISTRY`，实时反映在分层装配下拉选项中。
  2. **大模型自动生成管理 (LLM Generation Lifecycle)**：
     * 建立标准化的 LLM Generation Prompt，注入《视效设计范式与五大强约束准则》。
     * 用户仅需输入简要物理意象概念（如“戴森球引力光环”），系统自动合成出包含文字视域护盾、节拍总线绑定、照度上限截断的自洽插件代码。
     * 提供“沙箱独立测试”与“一键采纳并入库”闭环，直接持久化到前端插件名录中。
  3. **保存与版本管理 (Save & Versioning Lifecycle)**：
     * 用户在工作台中的一切分层装配改动，均通过双缓冲策略维护：内存响应 $\to$ `localStorage` 实时持久化防丢 $\to$ 后端 API `POST /api/save-timeline` 实盘持久化写入 `public/tracks/<track>/timeline.json`。

* 验证基准与技术结论
  1. 经由 Playwright 无头 GPU 驱动执行端到端实测验证，生成的五项关键资产已全部落盘存根：
     * `layered_01_workbench_assembler.png`：独立工作台 5 层装配器与双演示按钮界面。
     * `layered_02_trilogy_asset_topology.png`：三位一体资源映射拓扑卡片与一致性校验。
     * `layered_03_effects_arsenal_roles.png`：19 款视效军械库图层角色与导入/生成管理入口。
     * `layered_04_ai_gen_modal.png`：大模型自动生成分层视效代码弹窗与规范检查。
     * `layered_05_multipass_render_silicon.png`：全屏 1080p60 多层正交合成实时渲染画面。
  2. 系统的分层架构兼顾了电影级镜头语言的无限丰富度与 WebGL 确定性渲染的工程稳定性，彻底消除了重叠遮盖、文字遮蔽与单一死板问题。

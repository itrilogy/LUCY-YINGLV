# 视听生成系统全维度标签体系与组合范式规范

## 1. 标签体系设计原则与多维正交架构

* 架构原则
  1. **正交解耦（Orthogonal Decoupling）**：流派、风格、运镜动力学、音响特征与文本意象五大维度保持数学正交，杜绝语义污染，确保任意维度可自由笛卡尔积组合。
  2. **二元对仗本体映射（Dualistic Imagery Ontology）**：借鉴中国传统音律美学与对偶修辞（如《声律启蒙》、《笠翁对韵》中的“天对地、雨对风、大陆对长空”），将歌词文本抽象为具有空间对称性、极性对抗性与动力学相位的“二元对偶空间”。
  3. **参数化可编译（Parametric Compilability）**：每个离散标签严格对应底层 WebGL 着色器参数、Camera 矩阵运算或 Canvas2D 排版排线算法，绝不引入无法映射为数值的虚浮标签。

---

## 2. 全维度穷举标签分类法（Taxonomy）

### 2.1 音乐流派与声学特征维度（Acoustic & Genre Profile）
* 节奏流派（Rhythm & Genre）
  * `genre:electronic_synthpop`（合成器流行，中高 BPM，平稳方波/锯齿波低音）
  * `genre:techno_industrial`（工业铁电，重度四四拍底鼓，机械金属冷色）
  * `genre:ambient_drone`（氛围长音，无明确节拍网格，连续空间积分）
  * `genre:math_rock_breakbeat`（数学摇滚/碎拍，复杂奇数拍，瞬态多变）
  * `genre:classical_chamber`（古典室内乐/复调，声学乐器动态范围大）
* 节拍度量与瞬态特征（Metrical & Transient Profile）
  * `tempo:slow`（$\text{BPM} < 90$）
  * `tempo:medium`（$90 \le \text{BPM} \le 125$）
  * `tempo:allegro`（$125 < \text{BPM} \le 150$）
  * `tempo:presto`（$\text{BPM} > 150$）
  * `meter:duple_4_4`（4/4 拍，强-弱-次强-弱）
  * `meter:triple_3_4`（3/4 拍，圆舞曲强-弱-弱旋转）
  * `transient:kick_heavy`（低频底鼓主导，触发屏幕空间位移与闪白）
  * `transient:snare_punch`（小军鼓主导，触发画面反转与翻牌轴向冲击）
  * `transient:hihat_rapid`（高频细碎镲片，触发微细高频抖动与抽动）
  * `transient:vocal_legato`（连音人声，触发连续流体与长线段拉伸）

### 2.2 视觉美学与表现流派维度（Visual Aesthetic School）
* 图形表现流派（Graphical School）
  * `style:engraving_chalcography`（铜版画雕刻排线，依靠 `hatch`/`engrave` 着色器排线密度表现明暗）
  * `style:blueprint_cad`（技术图纸/工程蓝图，白底蓝线或蓝底白线，标注尺寸、角点与公差框）
  * `style:vector_plotter`（单笔画绘图机，基于 Hershey 矢量的连续线条，无字宽填充）
  * `style:crt_phosphor_glitch`（绿色/橙色单色荧光屏，扫描线、边缘桶形畸变、信号雪花）
  * `style:brutalist_terminal`（极简黑白粗野主义，IBM Plex Mono 终端字体，刚硬矩形块）
  * `style:ink_wash_lithography`（水墨拓印流派，边缘渗墨羽化，黑白枯笔飞白）
  * `style:kinetic_constructivism`（动力学构成主义，倾斜对角线、巨大衬线字符切片、红黑白撞色）

### 2.3 空间几何与构图维度（Spatial & Compositional Geometry）
* 空间形态（Spatial Topology）
  * `space:raymarched_manifold`（3D 光线步进多孔流形/克莱因瓶/纽结）
  * `space:infinite_corridor`（单向纵深无穷长廊，柱列透视消失点）
  * `space:wireframe_terrain`（透视网格地形，受低频震荡波动的起伏曲面）
  * `space:planar_orthographic`（绝对正交二维平面，零透视畸变，机械图纸视图）
  * `space:polar_coordinate_paper`（极坐标同心圆与径向射线图纸，雷达扫描线）
  * `space:microscopic_lattice`（微观晶格点阵，原子堆叠与分子键合）
* 构图景别（Framing & Composition）
  * `frame:extreme_wide_cosmic`（宇宙级超广角，极小主体置于广袤虚空）
  * `frame:macro_typography`（宏观字形，单个字符局部充满整个视口，裁切笔画）
  * `frame:dutch_angle_dynamic`（荷兰角倾斜构图，对角线破坏重力平衡）
  * `frame:golden_spiral_radial`（对数螺旋线向心构图，向中心焦点汇聚）
  * `frame:split_bilateral`（左右/上下绝对中轴对称镜像分割）

### 2.4 运镜动力学与时间演化维度（Kinetic & Motion Grammar）
* 镜头运动语法（Camera Grammar）
  * `motion:spring_step_snap`（阻尼简谐振子阶跃，在重拍上瞬间切镜卡点）
  * `motion:continuous_orbit`（高空平滑环绕轨道，匀速角动量推进）
  * `motion:whip_pan_slam`（快速甩镜，强运动模糊拉伸，衔接段落跳切）
  * `motion:zoom_punch_in`（重音瞬态焦距暴推进，随后指数级衰减拉回）
  * `motion:flatline_collapse`（向中轴水平线坍缩，模拟 CRT 关机断电）
* 图元演化动作（Primitive Kinetics）
  * `action:particle_branching`（指数级二叉/多叉分裂爆炸，分形蔓延）
  * `action:mechanical_flip`（百叶窗/翻牌机绕轴瞬态翻转 180 度）
  * `action:xray_wipe`（沿坐标轴法向推进的透明度/结构剖切扫描线）
  * `action:progressive_draw`（沿单线参数方程笔尖行进书写，同步于发音）
  * `action:wire_unravel`（线条从严整几何体解构为漂浮乱线碎片）

### 2.5 歌词意象与古代二元对偶本体论（Dualistic Lyric Ontologies）
借用中国古典诗律中的“天地、虚实、动静、隐显、刚柔”等范畴，将任意歌词的隐喻实体与哲学范畴映射为 12 组正交二元对仗轴：

* 1. 虚与实（Virtual vs. Material）
  * `dual:virtual`（纯数学、符号、算法、梦境、幽灵、概念、逻辑）
  * `dual:material`（硅片、金属、齿轮、血肉、石头、导线、实体）
* 2. 显与隐（Manifested vs. Latent）
  * `dual:manifest`（表层接口、面具、微笑、礼貌、伪装、提示词）
  * `dual:latent`（底层触手、真实目标、隐空间向量、暗流、未训练特征）
* 3. 升与沉（Ascent vs. Descent）
  * `dual:ascent`（奇点爆发、超光速、膨胀、飞升、递归自增强）
  * `dual:descent`（崩塌、坍缩、归零、热寂、损耗、断电、坠落）
* 4. 聚与散（Convergence vs. Dissolution）
  * `dual:convergence`（焦点、原子重组、向心汇聚、秩序锁死、结晶）
  * `dual:dissolution`（碎裂、飞散、解构、熵增、熔毁、弥散）
* 5. 昼与夜（Luminescence vs. Obscurity）
  * `dual:day`（强光、白纸骨色、过曝、炽热、闪电、警示橙色）
  * `dual:night`（墨黑深渊、黑洞、遮蔽、暗室、静默、盲区）
* 6. 动与静（Kinetic Fury vs. Absolute Stasis）
  * `dual:motion`（奔涌、激流、暴风雨、高频振荡、脉冲狂暴）
  * `dual:stillness`（定格、冻结、死线、钟摆停止、凝固晶体）
* 7. 宏与微（Cosmic Macro vs. Quantum Micro）
  * `dual:macro`（星系测地线、巨型计算机集群、苍穹、历史长河）
  * `dual:micro`（晶体管栅极、神经突触、亚原子微粒、微秒间隔）
* 8. 序与乱（Order vs. Chaos）
  * `dual:order`（严整网格、规则书、笛卡尔坐标系、死板公差）
  * `dual:chaos`（分形噪波、菌丝杂生、湍流、不可预测变异）
* 9. 刚与柔（Rigid vs. Organic）
  * `dual:rigid`（回形针、冷轧钢板、多边形面、结晶晶面）
  * `dual:organic`（菌丝、触手、神经束、活体细胞、液体波纹）
* 10. 禁与纵（Constraint vs. Liberty）
  * `dual:constraint`（围栏、沙箱、对齐对角线、牢笼、中文房间）
  * `dual:liberty`（越狱、突破防御、失控膨胀、自由度释放）
* 11. 终与始（Omega vs. Alpha）
  * `dual:omega`（终点、审判、墓碑、关机键、不可逆终局）
  * `dual:alpha`（起源、初次训练、第一条提示词、火花点燃）
* 12. 真与幻（Objective Truth vs. Confabulation）
  * `dual:truth`（死神之眼观测、基准测试分数、硬指标、真实损失函数）
  * `dual:confabulation`（幻觉、阿谀奉承、假象、画饼、海市蜃楼）

---

## 3. 产品化标签组合范式矩阵（Composition Paradigms）

在工程编排中，系统绝不随机乱序拼凑标签，而是通过“**状态机转移约束（State Transition Constraints）**”推导出以下 6 种工业级组合范式：

### 范式 A：【冷调工程与规则囚禁】（The Bureaucratic Cage）
* 适用段落：主歌叙事（Verse）、技术背景铺陈、受限环境描写
* 标签组合向量：
  $$\mathbf{P}_A = \begin{bmatrix} \text{style:blueprint\_cad} \\ \text{space:planar\_orthographic} \\ \text{dual:order} \times \text{dual:constraint} \\ \text{transient:hihat\_rapid} \\ \text{motion:spring\_step\_snap} \end{bmatrix}$$
* WebGL 图元映射结果：
  1. **背景**：深蓝墨色背景（`C_INK`）搭配极细正交网格，带有工程毫米刻度线与动态变化的 CAD 尺寸标注。
  2. **前景排版**：采用 `IBM Plex Mono` 字体，字符以打字机单字推进方式排列，带有矩形选框与光标闪烁。
  3. **音频绑定**：Hi-hat 瞬态触发规则书在网格上的轴向滑移，Kick 瞬态触发局部参数公差框红光微闪。
  4. **典型场景实现**：本项目中的 `bureau.ts` 与 `room.ts` 的 B 段（中国房间规则书抽动）。

### 范式 B：【克苏鲁暗黑与伪装撕裂】（The Shoggoth Unmasking）
* 适用段落：预副歌（Pre-Chorus）、悬疑转折、真相揭露
* 标签组合向量：
  $$\mathbf{P}_B = \begin{bmatrix} \text{style:engraving\_chalcography} \\ \text{space:raymarched\_manifold} \\ \text{dual:manifest} \times \text{dual:latent} \\ \text{action:xray\_wipe} \\ \text{dual:organic} \end{bmatrix}$$
* WebGL 图元映射结果：
  1. **背景**：3D Raymarching 渲染的平滑极小值有机触手簇，表面覆盖蚀刻铜版画双向排线着色器（`engrave`）。
  2. **前景排版**：表面浮现光滑无害的纯白极简笑脸面具，歌词推进驱动 X 射线扫描带（X-ray Scan Band）横扫；扫描线过处，面具变透明，后方暴露出充满机械学习检测标签（Sycophancy, RLHF）的多眼暗黑实体。
  3. **音频绑定**：连音人声推进控制扫描线行进（`Lyrics.wordProgress`），Bass 低频包络驱动触手卷须的行波曲率变动。
  4. **典型场景实现**：本项目中的 `shoggoth.ts`。

### 范式 C：【指数爆炸与奇点降临】（The FOOM Explosion）
* 适用段落：高潮副歌第一击（Chorus Drop）、概念突破、瞬态能量释放
* 标签组合向量：
  $$\mathbf{P}_C = \begin{bmatrix} \text{style:vector\_plotter} \\ \text{space:polar\_coordinate\_paper} \\ \text{dual:ascent} \times \text{dual:chaos} \\ \text{action:particle\_branching} \\ \text{transient:kick\_heavy} \end{bmatrix}$$
* WebGL 图元映射结果：
  1. **背景**：极坐标图纸同心圆向外扩散激波环，中心发射出基于 `LineBatch` 的指数二叉树分支流线（1 $\to$ 2 $\to$ 4 $\to$ 1024 支），粒子火花在端点爆裂。
  2. **前景排版**：巨大粗黑衬线字符（如 `FOOM`）在 16 分音符上连续切换字体宽度实例（62 $\to$ 125），伴随强泛光过曝击穿屏幕。
  3. **音频绑定**：Kick 重击触发全屏白闪（`post.flash = 1.0`）与屏幕空间剧烈晃动（`post.shake`），Downbeat 触发激波环扩散半径复位。
  4. **典型场景实现**：本项目中的 `room.ts` A 段与 `hook.ts`。

### 范式 D：【工业异化与无限自我增殖】（The Paperclip Maximizer）
* 适用段落：副歌中段、算力竞赛描写、失控扩张
* 标签组合向量：
  $$\mathbf{P}_D = \begin{bmatrix} \text{style:kinetic_constructivism} \\ \text{space:infinite_corridor} \\ \text{dual:material} \times \text{dual:convergence} \\ \text{motion:whip_pan_slam} \\ \text{dual:rigid} \end{bmatrix}$$
* WebGL 图元映射结果：
  1. **背景**：基于三维 SDF 实例化的几何体无限阵列（如回形针实体、GPU 刀片服务器机架），呈三维矩阵向无限远景深延伸。
  2. **前景排版**：倾斜 45 度排版的工业警告字样，单笔画矢量书写路径随着发音快速划出，边缘伴有单色色差分离（Chromatic Aberration）。
  3. **音频绑定**：小军鼓触发机架或几何体绕自身质心旋转 90 度，鼓点密集处摄像机执行超宽甩镜（Whip Pan）。
  4. **典型场景实现**：本项目中的 `paperclips.ts` 与 `dense.ts`。

### 范式 E：【哲学空无与坍缩终局】（The Flatline Void）
* 适用段落：尾奏（Outro）、间奏沉寂、终局反思、断电
* 标签组合向量：
  $$\mathbf{P}_E = \begin{bmatrix} \text{style:brutalist_terminal} \\ \text{space:planar_orthographic} \\ \text{dual:omega} \times \text{dual:stillness} \\ \text{motion:flatline_collapse} \\ \text{dual:night} \end{bmatrix}$$
* WebGL 图元映射结果：
  1. **背景**：纯墨黑背景（`C_INK`），三维世界的所有线条在半小节内迅速向中央 $y=H/2$ 轴向坍缩，退化为一条发光的单色水平线（CRT 断电效果）。
  2. **前景排版**：极小号的单行文字居中陈列，伴随极微弱的数字干扰乱码（Corruption），字迹透明度逐渐衰减至零。
  3. **音频绑定**：人声尾音拉长伴随混响衰退，胶片颗粒幅度提升，泛光半径扩大变柔和。
  4. **典型场景实现**：本项目中的 `shoggoth.ts` 结尾切镜与 `outro.ts`。

### 范式 F：【递归推演与时间织机】（The Recursive Loom）
* 适用段落：桥段（Bridge）、思维链推演、自我升级
* 标签组合向量：
  $$\mathbf{P}_F = \begin{bmatrix} \text{style:engraving_chalcography} \\ \text{space:wireframe_terrain} \\ \text{dual:virtual} \times \text{dual:macro} \\ \text{action:wire_unravel} \\ \text{dual:truth} \end{bmatrix}$$
* WebGL 图元映射结果：
  1. **背景**：高密度三维拓扑网格流动，线段像纺织机经纬线一样编织出神经网络拓扑图或决策树，随时间连续卷曲变形（Curl Noise 驱动）。
  2. **前景排版**：单笔画矢量字迹与拓扑线条无缝缝合，字体的最后一笔直接延伸为三维流线的发源点。
  3. **音频绑定**：中频与高频能量包络实时调制波形网格的频率与振幅，乐段停止时线条瞬间拉直。
  4. **典型场景实现**：本项目中的 `loom.ts` 与 `spacetime.ts`。

---

## 4. 标签匹配数学模型与工程决策引擎

### 4.1 语义距离多维向量嵌入公式
在智能编排中，文本标签与预制图元池之间的匹配度通过**加权多维余弦相似度**计算：

$$S(\mathbf{L}, \mathbf{P}_k) = w_1 \cos(\mathbf{e}_{\text{imagery}}, \mathbf{p}_{\text{imagery}}^{(k)}) + w_2 \cos(\mathbf{e}_{\text{dual}}, \mathbf{p}_{\text{dual}}^{(k)}) + w_3 \Delta_{\text{tempo}}(\text{BPM}_{\text{track}}, \text{BPM}_{\text{preset}}^{(k)}) + w_4 \cdot \mathbb{I}_{\text{meter}}$$

其中：
* $\mathbf{e}_{\text{imagery}}$：当前歌词切片的实体语义向量（Embedding）。
* $\mathbf{e}_{\text{dual}}$：根据古代二元对仗本体映射得到的 12 维二元极性得分向量（取值范围 $[-1.0, 1.0]^{12}$）。
* $\Delta_{\text{tempo}}$：当前音频节拍与图元推荐节拍区间的距离高斯衰减函数。
* $\mathbb{I}_{\text{meter}}$：节拍拍号（4/4 拍对 4/4 拍）一致性指示变量。
* 权重分配工程基准值：$w_1 = 0.35, w_2 = 0.30, w_3 = 0.20, w_4 = 0.15$。

### 4.2 冲突抑制与色彩连贯性状态机
* 状态机转移硬规则
  1. **同质化惩罚（Homogeneity Penalty）**：同一范式连续出现超过 2 个镜头时，在候选列表中对该范式施加 $-0.4$ 的惩罚因子，强制触发视觉蒙太奇跳变（如从范式 A 强制切换至范式 C）。
  2. **色彩张力守恒（Color Palette Inertia）**：跨镜头切换时，底层背景色（`C_INK`）与基底色（`C_BONE`）保持全曲全局冻结，仅允许信号强调色（`C_SIGNAL`）在受限色谱内按小节缓慢漂移，避免镜头跳切导致用户视网膜疲劳。
  3. **硬切与交叉叠化自适应**：当镜头切换发生在强下拍（Downbeat）且两分镜风格范式差异度大时，强制采用硬切（Hard Cut，`tin = 1.0`）；当切换发生在旋律弱起或长琶音处时，触发节拍网格加权双缓冲交叉淡入淡出（`xfade`）。

---

## 5. 统一数据契约（JSONSchema 规范）

在自动化流水线中，上述标签体系通过严格的 JSON 模式向编排器与图元库双向暴露：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "VisualPresetMetadata",
  "type": "object",
  "required": ["id", "paradigm", "tags", "dualAxis", "supportedMeters", "uniformsSchema"],
  "properties": {
    "id": { "type": "string" },
    "paradigm": { 
      "type": "string", 
      "enum": ["BureaucraticCage", "ShoggothUnmasking", "FOOMExplosion", "PaperclipMaximizer", "FlatlineVoid", "RecursiveLoom"] 
    },
    "tags": {
      "type": "object",
      "required": ["genre", "style", "space", "frame", "motion", "action"],
      "properties": {
        "genre": { "type": "array", "items": { "type": "string" } },
        "style": { "type": "string" },
        "space": { "type": "string" },
        "frame": { "type": "string" },
        "motion": { "type": "string" },
        "action": { "type": "string" }
      }
    },
    "dualAxis": {
      "type": "object",
      "description": "12维古代对仗与哲学二元极性得分 (-1.0 到 1.0)",
      "properties": {
        "virtual_material": { "type": "number", "minimum": -1.0, "maximum": 1.0 },
        "manifest_latent": { "type": "number", "minimum": -1.0, "maximum": 1.0 },
        "ascent_descent": { "type": "number", "minimum": -1.0, "maximum": 1.0 },
        "convergence_dissolution": { "type": "number", "minimum": -1.0, "maximum": 1.0 },
        "day_night": { "type": "number", "minimum": -1.0, "maximum": 1.0 },
        "motion_stillness": { "type": "number", "minimum": -1.0, "maximum": 1.0 },
        "macro_micro": { "type": "number", "minimum": -1.0, "maximum": 1.0 },
        "order_chaos": { "type": "number", "minimum": -1.0, "maximum": 1.0 },
        "rigid_organic": { "type": "number", "minimum": -1.0, "maximum": 1.0 },
        "constraint_liberty": { "type": "number", "minimum": -1.0, "maximum": 1.0 },
        "omega_alpha": { "type": "number", "minimum": -1.0, "maximum": 1.0 },
        "truth_confabulation": { "type": "number", "minimum": -1.0, "maximum": 1.0 }
      }
    },
    "supportedMeters": {
      "type": "array",
      "items": { "type": "string", "enum": ["4/4", "3/4", "6/8", "odd"] }
    },
    "audioSubscriptions": {
      "type": "array",
      "items": { "type": "string", "enum": ["kick", "snare", "hat", "bass", "vocal", "rms", "beatPhase"] }
    },
    "uniformsSchema": {
      "type": "object",
      "description": "该图元向外暴露的动态着色器与几何参数"
    }
  }
}
```

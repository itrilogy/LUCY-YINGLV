# 鹿溪·视听织机 (LUXI V-LOOM) 产品需求文档 (PRD v2.4 LTS)
# (Product Requirements Document: Multi-Pass Lens Assembly, Trilogy Mapping & Effect Lifecycle)

* 产品愿景与定位
  1. 产品名称：鹿溪·视听织机 (LUXI V-LOOM / Genesis AV Matrix Studio)。
  2. 产品 Slogan：“声相自洽，织境入微”。
  3. 核心商业价值主张：
     * **降维生产成本**：传统 After Effects / Blender 制作一首 3 分钟电影级视听视频需要 80~120 小时人工关键帧打点；本产品通过物理声学总线绑定、大模型意象编排与五层正交镜头装配，将高质量镜头制作时间缩减至 15 分钟以内。
     * **参数化确定性与绝对锐度**：纯 WebGL 光线步进（Raymarching）与 Instanced Capsule SDF 矢量图元驱动，输出原生 1080p60 / 4K60 像素级极限锐度，彻底告别生成式视频的运动畸变与文字乱码幻觉。
     * **资产正交复利**：五层正交架构实现 $N_{\text{bg}} \times N_{\text{img}} \times N_{\text{acc}} \times N_{\text{typo}} \times N_{\text{color}}$ 指数级镜头排列组合，每新增 1 个视效插件，系统可用镜头数呈倍数剧增。

* 目标用户画像与核心场景
  1. **专业音乐制作人 / 独立音乐人**：
     * 场景：完成音轨混音后，上传伴奏与 LRC 歌词，5 分钟内一键生成视听高度同步的电影级 Visualizer / 歌词分镜视频。
  2. **新媒体创意总监 / 视觉设计师**：
     * 场景：借助工作台的“五层镜头语言装配台”，微调特定段落的背景机房、黑洞意象、火花线条、重压字模与情绪色调，实现高定化视听体验。
  3. **技术美术 (TA) / 图形学开发者**：
     * 场景：通过“视效军械库”的导入接口或大模型生成器，快速编写符合《视效设计范式与强约束规范》的新着色器插件，在独立沙箱中实时热测试并持久化入库。

* 核心功能模块规格 (Functional Specifications)
  1. **模块一：五层正交镜头装配器 (5-Pass Layered Lens Assembler)**
     * **功能概述**：在【01 视觉编排】主面板中，为时间轴上的每一幕切片提供精细化的五层分层配置。
     * **层级规范**：
       * Layer 0 (背景层 Background)：支持 `terrain`、`room-terminal`、`tunnel`、`glitch`、`none` 选择。
       * Layer 1 (意象物层 Imagery)：支持 `hardware-stack`、`gantt-maneuver`、`bureau-stamps`、`cyber-shoggoth`、`spacetime-lens`、`infinite-clips`、`ascent-odometer`、`dense-cluster`、`matrix-loom`、`none` 选择。
       * Layer 2 (点缀线条层 Accent)：支持 `acoustic-loss`、`fuse-spark`、`glitch`、`none` 选择。
       * Layer 3 (字效排版层 Typography)：支持 `kinetic-press`、`cyber-prompt`、`kinetic-hook`、`typography`、`none` 选择。
       * Layer 4 (情绪调色 Color Grade)：支持 `cold-industrial`、`warning-crimson`、`cyber-green`、`void-monochrome`、`noir-gold` 五大 LUT 预设。
     * **自动化辅助**：提供 `[ ⚡ 智能匹配五层装配 ]` 按钮，根据当前切片歌词的语义张量特征，自动完成五层最优配置。
  2. **模块二：三位一体资源映射拓扑中枢 (Trilogy Asset Mapping Topology)**
     * **功能概述**：在【02 歌曲加工】面板中，建立歌曲音频、歌词分词与编排时序三者的强一致性映射卡片。
     * **状态展示与交互**：
       * 音频资源节点：展示时长（如 156.7s）、采样率、BPM（110.0）、下拍卡点数（87 Bars）及 100 FPS 特征包提取状态。
       * 歌词资源节点：展示行数（46 行）、单字微秒进度（227 词）、CTC Viterbi 算法模型及对齐置信度（94.2%）。
       * 编排时序节点：展示切片总数（16 幕）、严格接壤状态（$\Delta t = 0.0\text{s}$）、挂载插件生态（19 款）。
       * 提供 `[ 🔄 校验三位一体映射与热同步 ]` 按钮，一键触发三者起止对齐状态机校验。
  3. **模块三：视效军械库与全生命周期管理中枢 (Effect Arsenal & Lifecycle Management)**
     * **功能概述**：集中治理 19 款通用插件，并提供代码导入、大模型生成、沙箱热测试与持久化入库闭环。
     * **核心能力**：
       * 插件名录卡片：卡片右上角清晰标示其所属图层角色（`0.背景基底层`、`1.意象主体物层`、`2.点缀线条层`、`3.字效排版层`）。
       * 自定义插件导入弹窗：支持输入插件英文 ID、中文名、图层角色定位与 TypeScript/GLSL 代码，支持在独立沙箱中测试与保存入库。
       * 大模型生成弹窗：输入意象概念（如“戴森球引力光环”），自动注入强约束规则集，生成带文字反差护盾与节拍总线绑定的规范代码。
       * 独立沙箱测试：点击 `[ 🧪 独立沙箱测试 ↗ ]`，在独立新标签页中以纯净模式预览该单项插件的 60 FPS 渲染。
  4. **模块四：官方演示预设一键触达 (Preset Demo Fast-Track)**
     * **功能概述**：在顶部导航栏提供两大官方最高水准编排预设按钮：
       * `[ 🌟 官方推荐编排示例 (Load Masterpiece Preset) ]`：一键载入 16 幕黄金叙事闭环编排。
       * `[ 🎬 电影级分层镜头示例 (Load Layered Cinema Preset) ]`：一键载入 9 幕五层正交复合镜头编排（背景+意象+点缀+字效+调色同时渲染）。
  5. **模块五：解耦全屏播放器 (Full-Screen Decoupled Player)**
     * **功能概述**：点击 `[ 🚀 整体全屏预览 ↗ ]`，在新标签页打开 `/?track=demo&preview=full`。
     * **播放器特性**：1080p60 纯净沉浸模式、底部微型时间轴、空格键暂停/播放、左/右方向键逐秒快进/快退。

* 鹿溪设计范式规范落地 (Design Tokens & Brand Identity)
  1. **产品方标 (Product Brick Mark)**：
     * 尺寸与底座：48×48px 鹿溪绿（`#0D5E42`，`border-radius: 12px`）圆角砖底座。
     * 流线与金星：底端点缀天青色水平流线（`#00D2FF`），右上角镶嵌五角金星（`#F1C40F`）。
     * 业务矢量图形：中心视口内嵌几何波形棱镜矢量图形。
  2. **实验室官方主标 (Laboratory Official Mark)**：
     * 顶部品牌集群左侧完整置入 `#luxi-symbol-mark`，标明“LUXI V-LOOM // 鹿溪联合创新实验室”。
  3. **产品调色板 (Design Tokens)**：
     * 品牌主色：鹿溪绿 `#0D5E42`、源启白 `#F5F7FA`。
     * 科技点缀色：天青进化蓝 `#00D2FF`、黄金叙事金 `#F1C40F`、警示赤红 `#E74C3C`。
     * 底材色彩体系：页面底色 `#0B0C0E`、卡片底色 `#14171A`、浮层高亮 `#1C2126`、凹陷输入底色 `#070809`。

* 非功能性需求与技术 SLA 指标
  1. **渲染帧率稳定性**：
     * 在 Apple Silicon M3 / M3 Pro / M3 Ultra 统一内存架构下，1080p60 实时预览帧率恒定在 $60.0 \pm 0.5$ FPS。
  2. **时序严格接壤 SLA**：
     * 分镜相邻重叠率严格满足 $t_{\text{end}}^{(i)} - t_{\text{start}}^{(i+1)} \equiv 0.000\text{ ms}$，严禁任何非受控交叉重叠。
  3. **文字可读性反差守恒 SLA**：
     * 字效层无论在何种复杂背景或意象物层上方，前背景对比度恒满足 $\ge 4.5:1$（WCAG AAA 级），依靠 $1.0\times$ 紧密黑色描边与中央径向吸光护盾强制达成。
  4. **照度上限截断 SLA**：
     * 全局线性 HDR 像素照度严格截断于 $L_{\text{HDR}} \le 1.4$，彻底杜绝 Bloom 泛滥吞噬画面与刺眼过曝。
  5. **内存与显存零 GC 泄露 SLA**：
     * 引擎通过预分配的静态全局环形 `RenderTarget` 缓冲池复用显存，整曲连续循环播放 30 分钟无 V8 垃圾回收卡顿与 GPU 显存增长。

* 验收标准与交付检查清单
  1. 独立工程化页面 `studio.html` 已成功上线并支持全功能交互。
  2. 19 款通用视效插件全部完成图层角色标定，且均可通过独立沙箱进行热验证。
  3. 电影级五层分层预设与官方黄金预设均可在独立播放器中流畅无损渲染。
  4. 5 张全景实测渲染截图均已保存至 `素材/` 目录，无报错无坏死。

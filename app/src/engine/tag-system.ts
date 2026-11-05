// TagSystem: 鹿溪视听织机全维度标签体系、意象本体库与大模型编排中枢
// 依照《视听生成系统全维度标签体系与组合范式规范》及《鹿溪设计范式》构建
import { FILM_PLATES } from './film-catalog.ts';
import { GENERATED_ASSETS } from './generated-catalog.ts';

export interface TagDefinition {
  id: string;
  name: string;
  en: string;
  category: 'style' | 'imagery' | 'acoustic' | 'motion';
  desc: string;
  color: string;
}

export interface PluginMeta {
  id: string;
  name: string;
  zhName: string;
  sourceScene: string;
  /** Primary orthogonal layer pass role. */
  layerRole: 'background' | 'imagery' | 'accent' | 'typography' | 'hybrid';
  styles: string[];
  imageries: string[];
  acousticFocus: ('kick' | 'snare' | 'hat' | 'bass' | 'lead-vocal' | 'ambient')[];
  recommendedPaces: ('fast' | 'medium' | 'slow' | 'outro')[];
  description: string;
  promptGuidance: string;
  /** film = original scene plate, bespoke = hand plugin, generated = model-written file. */
  origin?: 'film' | 'bespoke' | 'generated';
  /** plate fills a shot; layer is one pass of a stack. */
  kind?: 'plate' | 'layer';
  /** Copied onto the timeline entry when this plate is chosen. */
  paramsHint?: Record<string, unknown>;
  maxSamples?: number;
  /** False: a sung solo of this plugin must be wrapped with lyric-line. */
  ownsLyrics?: boolean;
  /** Disk header status for model-written files. */
  assetStatus?: 'temporary' | 'asset';
}

export interface ColorGradeDefinition {
  id: string;
  name: string;
  en: string;
  desc: string;
  accentColor: string;
}

/** 5 大情绪表达调色预设 (Color Grade Moods) */
export const COLOR_GRADES: ColorGradeDefinition[] = [
  { id: 'cold-industrial', name: '冷调工业', en: 'Cold Industrial', desc: '冷峻蓝灰、高锐度暗部、机械工程严谨感', accentColor: '#00D2FF' },
  { id: 'warning-crimson', name: '告警赤红', en: 'Warning Crimson', desc: '危机红光弥漫、重度光晕泛滥、高张力压迫感', accentColor: '#E74C3C' },
  { id: 'cyber-green', name: '赛博黑客绿', en: 'Cyber Green', desc: 'CRT 荧光微绿、终端扫描线、穿透夜空', accentColor: '#27AE60' },
  { id: 'void-monochrome', name: '空无单色', en: 'Void Monochrome', desc: '极致黑白高反差、粗颗粒、虚无终局感', accentColor: '#BDC3C7' },
  { id: 'noir-gold', name: '新黑色金', en: 'Noir Gold', desc: '金色光辉、浓郁电影质感、哲学沉思感', accentColor: '#F1C40F' },
];

/** 1. 美学流派标签 (Aesthetic Styles) */
export const AESTHETIC_STYLES: TagDefinition[] = [
  { id: 'style_cyber_brutalism', name: '赛博粗野主义', en: 'Cyber Brutalism', category: 'style', desc: '冷峻工业管线、粗颗粒黑白对比、巨构硬件压迫感', color: '#00D2FF' },
  { id: 'style_industrial_tech', name: '工业重工技术', en: 'Industrial Tech', category: 'style', desc: '机械冲压、液压字模、装配流水线、刚性阻尼振荡', color: '#F1C40F' },
  { id: 'style_eldritch_cosmic', name: '克苏鲁高维深渊', en: 'Eldritch Cosmic', category: 'style', desc: '不可名状多维波动、面具撕裂、虚实本体二元对立', color: '#9B51E0' },
  { id: 'style_holographic_terminal', name: '全息监视终端', en: 'Holographic Terminal', category: 'style', desc: '多屏闭路监控、CRT 荧光扫描、雷达极坐标、状态遥测', color: '#27AE60' },
  { id: 'style_administrative_cold', name: '官僚行政冷调', en: 'Administrative Cold', category: 'style', desc: '公文档案网格、复印机扫描光带、行政双边框、审批撞击印章', color: '#BDC3C7' },
  { id: 'style_quantum_spacetime', name: '量子时空透镜', en: 'Quantum Spacetime', category: 'style', desc: '黑洞事件视界、广义相对论引力透镜弯曲、轨道测地线', color: '#2D9CDB' },
  { id: 'style_micro_silicon', name: '微观硅基晶圆', en: 'Micro Silicon', category: 'style', desc: '纳米光刻蚀刻、半导体阵列、步进扫描极紫外光', color: '#0D5E42' },
  { id: 'style_tactical_telemetry', name: '战术规避矩阵', en: 'Tactical Telemetry', category: 'style', desc: '甘特图计划线、风险临界仪表盘、左转轨迹规避', color: '#E74C3C' },
];

/** 2. 哲学与具象意象标签 (Semantic Imagery) */
export const SEMANTIC_IMAGERIES: TagDefinition[] = [
  { id: 'img_singularity', name: '技术奇点与飞跃', en: 'Singularity Jump', category: 'imagery', desc: '能力边界突变、指数爆炸、不可逆跃迁', color: '#00D2FF' },
  { id: 'img_bureaucratic_lock', name: '体制囚禁与公文审核', en: 'Bureaucratic Gridlock', category: 'imagery', desc: '算力配额配给、红线禁令、纸质档案牢笼', color: '#BDC3C7' },
  { id: 'img_exponential_foom', name: '指数分支爆炸 (FOOM)', en: 'Exponential FOOM', category: 'imagery', desc: '1至1024分支扩散、激波冲击波环、自指失控', color: '#F1C40F' },
  { id: 'img_compute_clusters', name: '十万级算力集群', en: 'Compute Superpod', category: 'imagery', desc: '高密度机架阵列、3.2Tbps 光纤网络、百兆瓦功耗', color: '#27AE60' },
  { id: 'img_paperclips_lattice', name: '回形针晶格自我增殖', en: 'Infinite Replication', category: 'imagery', desc: '资源吞噬、三维晶格复制、功利最大化盲目性', color: '#9B51E0' },
  { id: 'img_shoggoth_mask', name: '修格斯本体与面具', en: 'Shoggoth & Mask', category: 'imagery', desc: '对齐伪装、高维异质张量、目标锁定框', color: '#EB5757' },
  { id: 'img_hardware_stack', name: '从硅晶圆到世界模型', en: 'Full Hardware Stack', category: 'imagery', desc: '芯片微观晶体管到机架宏观网络的拓扑穿越', color: '#0D5E42' },
  { id: 'img_tactical_left_turn', name: '急剧左转与风险规避', en: 'Sharp Left Turn', category: 'imagery', desc: '避障机动、甘特图临界倒计时、断臂求生', color: '#E74C3C' },
  { id: 'img_terminal_jailbreak', name: '终端破壁与流式打字', en: 'Terminal Prompt Stream', category: 'imagery', desc: '黑客流式输入、乱码重组、光标脉冲推进', color: '#00D2FF' },
  { id: 'img_grand_outro', name: '宏大尾奏与虚无归宿', en: 'Grand Outro Void', category: 'imagery', desc: '纯器乐极速几何穿梭、零文字干扰、星图漫游', color: '#2F80ED' },
];

/** 3. 声学度量驱动标签 (Acoustic Metrics) */
export const ACOUSTIC_METRICS: TagDefinition[] = [
  { id: 'ac_kick_impact', name: '底鼓重拍冲击 (Kick Impact)', en: 'Kick Impact', category: 'acoustic', desc: '低频瞬态激发的弹簧阻尼震颤与镜头微缩放', color: '#E74C3C' },
  { id: 'ac_hi_flux_snare', name: '军鼓高频通量 (Snare Flux)', en: 'Snare Flux', category: 'acoustic', desc: '中高频瞬态激发的粒子爆破与色散横扫', color: '#F1C40F' },
  { id: 'ac_hat_arpeggio', name: '踩镲高频琶音 (Hat Arp)', en: 'Hat Arpeggio', category: 'acoustic', desc: '十六分音符驱动的指示灯序列与光纤闪烁', color: '#00D2FF' },
  { id: 'ac_drone_bass', name: '长音低音引力 (Bass Drone)', en: 'Bass Drone', category: 'acoustic', desc: '低沉长音激发的时空曲率扭曲与网格涌动', color: '#9B51E0' },
  { id: 'ac_vocal_flow', name: '人声语速动态推进 (Vocal Flow)', en: 'Vocal Flow', category: 'acoustic', desc: 'CTC 词级时间戳锁定的卡拉OK发音进度条', color: '#27AE60' },
];

/** 4. 插件元数据知识库 (全 19 大效果器全景名录) */
export const PLUGIN_REGISTRY: Record<string, PluginMeta> = {
  'terrain': {
    id: 'terrain',
    name: 'DynamicTerrain',
    zhName: '赛博网格地平线',
    sourceScene: 'open.ts',
    layerRole: 'background',
    styles: ['style_cyber_brutalism', 'style_quantum_spacetime'],
    imageries: ['img_singularity', 'img_terminal_jailbreak'],
    acousticFocus: ['kick', 'ambient'],
    recommendedPaces: ['medium', 'slow'],
    description: '开场视差网格地平线、虚线激光束与全息 AGI 视线扫描。',
    promptGuidance: 'Suitable for intro narrative and opening exposition. Keep ground grid pulsing with bass.',
  },
  'acoustic-loss': {
    id: 'acoustic-loss',
    name: 'AcousticLoss',
    zhName: '声学通量折线图',
    sourceScene: 'loss.ts',
    layerRole: 'accent',
    styles: ['style_cyber_brutalism', 'style_tactical_telemetry'],
    imageries: ['img_singularity'],
    acousticFocus: ['kick', 'snare'],
    recommendedPaces: ['medium'],
    description: '实时音频能量损失折线图谱、激光扫描线与火花轨迹散点。',
    promptGuidance: 'Visualizes loss curve descent. Emphasize linear charts, data plots and spark emitters.',
  },
  'cyber-prompt': {
    id: 'cyber-prompt',
    name: 'CyberPrompt',
    zhName: '黑客终端字符流',
    sourceScene: 'prompt.ts',
    layerRole: 'typography',
    styles: ['style_cyber_brutalism', 'style_holographic_terminal'],
    imageries: ['img_terminal_jailbreak'],
    acousticFocus: ['hat', 'lead-vocal'],
    recommendedPaces: ['fast', 'medium'],
    description: '终端黑客流式逐字打字机、光标时钟节拍闪烁与字符乱码重组。',
    promptGuidance: 'High-density narrative. Character scramble decryption on sixteenth notes.',
  },
  'kinetic-hook': {
    id: 'kinetic-hook',
    name: 'KineticHook',
    zhName: '副歌大标题激波环',
    sourceScene: 'hook.ts',
    layerRole: 'typography',
    styles: ['style_industrial_tech', 'style_cyber_brutalism'],
    imageries: ['img_singularity', 'img_exponential_foom'],
    acousticFocus: ['kick', 'snare'],
    recommendedPaces: ['fast'],
    description: '副歌高能大字重击、同心圆激波环扩散与红蓝故障色散。',
    promptGuidance: 'Chorus peak energy. Massive glyphs with expanding shockwaves on kicks.',
  },
  'cyber-shoggoth': {
    id: 'cyber-shoggoth',
    name: 'CyberShoggoth',
    zhName: '修格斯触手与笑脸',
    sourceScene: 'shoggoth.ts',
    layerRole: 'imagery',
    styles: ['style_eldritch_cosmic', 'style_cyber_brutalism'],
    imageries: ['img_shoggoth_mask'],
    acousticFocus: ['kick', 'bass'],
    recommendedPaces: ['medium'],
    description: '高维多重触手波动、笑脸面具半透质感与死神之眼目标检测框。',
    promptGuidance: 'Eldritch AI metaphor. Organic tentacle field contrasted with synthetic white smiley mask.',
  },
  'spacetime-lens': {
    id: 'spacetime-lens',
    name: 'SpacetimeLens',
    zhName: '黑洞引力透镜弯曲',
    sourceScene: 'spacetime.ts',
    layerRole: 'imagery',
    styles: ['style_quantum_spacetime'],
    imageries: ['img_singularity'],
    acousticFocus: ['bass', 'ambient'],
    recommendedPaces: ['slow', 'medium'],
    description: '爱因斯坦环光线偏折、黑洞吸积盘自旋转与轨道测地线歌词。',
    promptGuidance: 'Cosmic scale. Gravitational lensing warping the background starry grid.',
  },
  'ascent-odometer': {
    id: 'ascent-odometer',
    name: 'AscentOdometer',
    zhName: '算力天梯与里程表',
    sourceScene: 'ascent.ts',
    layerRole: 'imagery',
    styles: ['style_industrial_tech', 'style_cyber_brutalism'],
    imageries: ['img_compute_clusters', 'img_singularity'],
    acousticFocus: ['kick', 'hat'],
    recommendedPaces: ['medium'],
    description: 'FLOPs 浮点运算量指数级机械滚轮狂飙、天梯网格透视攀升。',
    promptGuidance: 'Exponential ascent. Mechanical odometer rolling rapidly with compute metrics.',
  },
  'tunnel': {
    id: 'tunnel',
    name: 'TunnelSDF',
    zhName: '3D 光线几何回廊',
    sourceScene: 'bureau.ts',
    layerRole: 'background',
    styles: ['style_cyber_brutalism', 'style_quantum_spacetime'],
    imageries: ['img_singularity', 'img_grand_outro'],
    acousticFocus: ['kick', 'snare'],
    recommendedPaces: ['fast', 'outro'],
    description: '光线步进 3D 几何管道、无限延伸灭点与小节卡点旋转推进。',
    promptGuidance: 'High-speed flight. Raymarched geometric tunnel with camera roll on beat 4.',
  },
  'kinetic-press': {
    id: 'kinetic-press',
    name: 'KineticPress',
    zhName: '机械冲压工业排版',
    sourceScene: 'dense.ts',
    layerRole: 'typography',
    styles: ['style_industrial_tech'],
    imageries: ['img_tactical_left_turn'],
    acousticFocus: ['kick'],
    recommendedPaces: ['fast', 'medium'],
    description: '重型机床液压冲压、下拍底鼓弹簧回弹与视口自适应字模。',
    promptGuidance: 'Heavy machinery feel. Damped spring overshoot upon kick impacts.',
  },
  'infinite-clips': {
    id: 'infinite-clips',
    name: 'InfiniteClips',
    zhName: '回形针晶格自我增殖',
    sourceScene: 'paperclips.ts',
    layerRole: 'imagery',
    styles: ['style_cyber_brutalism', 'style_industrial_tech'],
    imageries: ['img_paperclips_lattice'],
    acousticFocus: ['hat', 'snare'],
    recommendedPaces: ['fast', 'medium'],
    description: '金属回形针三维空间晶格无限复制、空间占用自膨胀。',
    promptGuidance: 'Exponential replication. Endless clip grid rotating and multiplying endlessly.',
  },
  'fuse-spark': {
    id: 'fuse-spark',
    name: 'FuseSpark',
    zhName: '燃烧引信与音高追踪',
    sourceScene: 'fuse.ts',
    layerRole: 'accent',
    styles: ['style_cyber_brutalism', 'style_industrial_tech'],
    imageries: ['img_singularity'],
    acousticFocus: ['snare', 'lead-vocal'],
    recommendedPaces: ['medium'],
    description: '动态引信火花燃烧物理粒子轨迹、实时旋律音高曲线吸附。',
    promptGuidance: 'Urgent countdown. Spark burning along spline with dynamic audio pitch tracking.',
  },
  'dense-cluster': {
    id: 'dense-cluster',
    name: 'DenseCluster',
    zhName: '十万级算力机架集群',
    sourceScene: 'dense-gpu.ts',
    layerRole: 'imagery',
    styles: ['style_cyber_brutalism', 'style_industrial_tech'],
    imageries: ['img_compute_clusters'],
    acousticFocus: ['kick', 'hat'],
    recommendedPaces: ['medium', 'fast'],
    description: '数据中心十万 H100 GPU 机柜透视走廊、指示灯矩阵与光纤脉冲。',
    promptGuidance: 'Epic scale datacenter. Glowing LEDs and fiber optic pulse bus along server racks.',
  },
  'matrix-loom': {
    id: 'matrix-loom',
    name: 'MatrixLoom',
    zhName: '多维矩阵张量网络',
    sourceScene: 'loom.ts',
    layerRole: 'imagery',
    styles: ['style_cyber_brutalism', 'style_quantum_spacetime'],
    imageries: ['img_singularity', 'img_grand_outro'],
    acousticFocus: ['ambient', 'bass'],
    recommendedPaces: ['medium', 'outro'],
    description: '高维张量矩阵交织流动、注意力网络连线与流式 HUD 歌词。',
    promptGuidance: 'Multi-layer neural network matrix with dynamic attention edge illumination.',
  },
  'glitch': {
    id: 'glitch',
    name: 'GlitchOscilloscope',
    zhName: 'CRT 示波器与色散故障',
    sourceScene: 'bureau.ts',
    layerRole: 'accent',
    styles: ['style_cyber_brutalism', 'style_holographic_terminal'],
    imageries: ['img_terminal_jailbreak'],
    acousticFocus: ['snare', 'kick'],
    recommendedPaces: ['fast'],
    description: 'CRT 显像管行场同步偏转、示波器李萨如图形与 RGB 故障撕裂。',
    promptGuidance: 'Glitch aesthetics. Horizontal displacement scanlines and color channel split.',
  },
  'typography': {
    id: 'typography',
    name: 'DynamicTypography',
    zhName: '自适应动态动力学排版',
    sourceScene: 'open.ts',
    layerRole: 'typography',
    styles: ['style_cyber_brutalism'],
    imageries: ['img_singularity'],
    acousticFocus: ['lead-vocal'],
    recommendedPaces: ['medium', 'slow'],
    description: '高纯度文字动力学呈现、微秒级字音跟随卡拉OK高亮。',
    promptGuidance: 'Clean kinetic text. Centered text layout with tight contrasting stroke outline.',
  },
  'bureau-stamps': {
    id: 'bureau-stamps',
    name: 'BureauStamps',
    zhName: '官僚审批公文与印章',
    sourceScene: 'bureau.ts',
    layerRole: 'imagery',
    styles: ['style_administrative_cold', 'style_industrial_tech'],
    imageries: ['img_bureaucratic_lock'],
    acousticFocus: ['kick', 'ambient'],
    recommendedPaces: ['medium'],
    description: '行政公文纸张双边框、复印机蓝白光带扫描、打字机流与红色审批冲击印章。',
    promptGuidance: 'Cold administrative red tape. Photocopier scanning bar with slamming red rubber stamp.',
  },
  'room-terminal': {
    id: 'room-terminal',
    name: 'RoomTerminal',
    zhName: '全息 4 屏闭路监视阵列',
    sourceScene: 'room.ts',
    layerRole: 'background',
    styles: ['style_holographic_terminal', 'style_cyber_brutalism'],
    imageries: ['img_bureaucratic_lock', 'img_compute_clusters'],
    acousticFocus: ['kick', 'hat'],
    recommendedPaces: ['medium'],
    description: '4 窗口闭路监控矩阵：3D 超导核心旋转、音频频谱柱状跳动、战术雷达扫描、权重日志。',
    promptGuidance: 'Sci-fi command CCTV. Quad monitors displaying wireframe, spectrum analyzer and radar.',
  },
  'hardware-stack': {
    id: 'hardware-stack',
    name: 'HardwareStack',
    zhName: '硅晶圆到机架硬件堆栈',
    sourceScene: 'stack.ts',
    layerRole: 'imagery',
    styles: ['style_micro_silicon', 'style_industrial_tech'],
    imageries: ['img_hardware_stack', 'img_compute_clusters'],
    acousticFocus: ['kick', 'hat'],
    recommendedPaces: ['medium', 'fast'],
    description: '硅晶圆微观纳米光刻、Die 封装、PCIe 总线到机架宏观计算堆栈穿越。',
    promptGuidance: 'Cross-scale hardware journey. Microscopic wafer transistors scaling up to server racks.',
  },
  'gantt-maneuver': {
    id: 'gantt-maneuver',
    name: 'GanttManeuver',
    zhName: '战术甘特图与规避机动',
    sourceScene: 'leftturn.ts',
    layerRole: 'imagery',
    styles: ['style_tactical_telemetry', 'style_administrative_cold'],
    imageries: ['img_tactical_left_turn'],
    acousticFocus: ['kick', 'snare'],
    recommendedPaces: ['fast', 'medium'],
    description: '安全规避时间轴甘特图、临界风险阻抗仪表盘与急剧左转回避机动。',
    promptGuidance: 'Critical emergency maneuver. Gantt schedule timeline with flashing alarm indicators.',
  },
  'lyric-line': {
    id: 'lyric-line',
    name: 'LyricLine',
    zhName: '一行词',
    sourceScene: 'lyric-line.ts',
    layerRole: 'typography',
    styles: ['style_cyber_brutalism'],
    imageries: ['img_singularity'],
    acousticFocus: ['lead-vocal'],
    recommendedPaces: ['fast', 'medium', 'slow', 'outro'],
    description: '透明字层。一词的最后一个字形在 word.end 写满，不铺墨底。',
    promptGuidance: 'One lyric line via paintShotLine. Transparent clear. No opaque plate.',
    origin: 'bespoke',
    kind: 'layer',
    ownsLyrics: true,
  },
};

for (const plate of FILM_PLATES) PLUGIN_REGISTRY[plate.id] = plate;
for (const meta of GENERATED_ASSETS) {
  if (!PLUGIN_REGISTRY[meta.id]) PLUGIN_REGISTRY[meta.id] = meta;
}

/** 按图层角色获取候选视效插件列表 */
export function getPluginsByLayer(role: 'background' | 'imagery' | 'accent' | 'typography'): PluginMeta[] {
  return Object.values(PLUGIN_REGISTRY).filter(p => p.layerRole === role || p.layerRole === 'hybrid');
}

/** 5 层正交镜头组装推荐器 */
export function assembleLayeredLens(lyricText: string, options: { preferredStyle?: string; preferredImagery?: string; colorGrade?: string } = {}) {
  const match = matchOptimalVisualPlugin(lyricText);
  const matchedPlugin = PLUGIN_REGISTRY[match.plugin];

  // 1. 意象物层：优先匹配语义命中
  let imagery = match.plugin;
  if (matchedPlugin && matchedPlugin.layerRole !== 'imagery') {
    imagery = 'hardware-stack';
  }

  // 2. 背景层：依据节奏与意象匹配
  let background = 'terrain';
  if (/room|monitor|terminal|radar/i.test(lyricText)) background = 'room-terminal';
  else if (/tunnel|fly|speed|outro/i.test(lyricText)) background = 'tunnel';

  // 3. 点缀线条层：
  let accent = 'acoustic-loss';
  if (/fuse|spark|burn|fire/i.test(lyricText)) accent = 'fuse-spark';
  else if (/glitch|crt|noise|error/i.test(lyricText)) accent = 'glitch';

  // 4. 字效层：
  let typography = 'kinetic-press';
  if (/chatgpt|sydney|prompt|type/i.test(lyricText)) typography = 'cyber-prompt';
  else if (/hook|future|pdoom/i.test(lyricText)) typography = 'kinetic-hook';
  else if (lyricText.length > 25) typography = 'typography';

  // 5. 情绪色调层：
  let colorGrade = options.colorGrade || 'cold-industrial';
  if (/alarm|danger|fear|pdoom|left/i.test(lyricText)) colorGrade = 'warning-crimson';
  else if (/matrix|tensor|chatgpt/i.test(lyricText)) colorGrade = 'cyber-green';
  else if (/void|fade|end|outro/i.test(lyricText)) colorGrade = 'void-monochrome';
  else if (/singularity|spacetime|gold/i.test(lyricText)) colorGrade = 'noir-gold';

  return {
    background,
    imagery,
    accent,
    typography,
    colorGrade,
    rationale: `基于语义 [${match.matchedTag.name}] 推荐：背景[${background}] + 意象[${imagery}] + 点缀[${accent}] + 字效[${typography}]，搭载情绪调色[${colorGrade}]`,
  };
}

/** 5. 意象与语义自动化加权匹配算法 (Semantic Tag Matching Engine) */
export function matchOptimalVisualPlugin(lyricText: string, audioPhase: { isChorus?: boolean; isOutro?: boolean; isIntro?: boolean } = {}): { plugin: string; matchedTag: TagDefinition; confidence: number; rationale: string } {
  const text = lyricText.toLowerCase();

  // 优先级 1：特殊结构段落
  if (audioPhase.isOutro || /grand|outro|fade|end/i.test(text)) {
    return {
      plugin: 'tunnel',
      matchedTag: SEMANTIC_IMAGERIES.find(x => x.id === 'img_grand_outro')!,
      confidence: 0.98,
      rationale: '检测到曲目纯器乐高潮尾奏，启用极速无障碍 3D 光线几何回廊。',
    };
  }
  if (audioPhase.isIntro && text.length < 5) {
    return {
      plugin: 'terrain',
      matchedTag: AESTHETIC_STYLES.find(x => x.id === 'style_cyber_brutalism')!,
      confidence: 0.95,
      rationale: '检测到前奏低沉启动期，启用开场赛博网格地平线视差。',
    };
  }

  // 优先级 2：精确语义关键词与张量本体映射规则
  const SEMANTIC_RULES: { pattern: RegExp; plugin: string; tagId: string; rationale: string }[] = [
    { pattern: /wafer|silicon|transistor|stack|die|nanometer/i, plugin: 'hardware-stack', tagId: 'img_hardware_stack', rationale: '匹配硅晶圆半导体与硬件堆栈拓扑意象。' },
    { pattern: /gantt|turn|evade|left|sharp|obstacle|maneuver/i, plugin: 'gantt-maneuver', tagId: 'img_tactical_left_turn', rationale: '匹配应急避障左转机动与甘特图排程意象。' },
    { pattern: /bureau|pto|form|commission|paper|audit|law/i, plugin: 'bureau-stamps', tagId: 'img_bureaucratic_lock', rationale: '匹配官僚机构公文、行政审核与红色审批印章意象。' },
    { pattern: /room|monitor|terminal|radar|cctv|screen|chinese/i, plugin: 'room-terminal', tagId: 'style_holographic_terminal', rationale: '匹配全息控制室闭路监控与多屏阵列意象。' },
    { pattern: /gpu|dense|cluster|datacenter|h100|compute/i, plugin: 'dense-cluster', tagId: 'img_compute_clusters', rationale: '匹配十万级算力机架集群与光纤总线意象。' },
    { pattern: /paperclips|fill|clips|expand|multiply/i, plugin: 'infinite-clips', tagId: 'img_paperclips_lattice', rationale: '匹配回形针三维晶格无限自我增殖意象。' },
    { pattern: /shoggoth|mask|smile|tentacle|fear|face/i, plugin: 'cyber-shoggoth', tagId: 'img_shoggoth_mask', rationale: '匹配高维触手深渊与笑脸面具对立二元意象。' },
    { pattern: /singularity|spacetime|blackhole|lens|gravity/i, plugin: 'spacetime-lens', tagId: 'style_quantum_spacetime', rationale: '匹配广义相对论时空曲率弯曲与黑洞视界意象。' },
    { pattern: /chatgpt|sydney|prompt|type|cursor|shell/i, plugin: 'cyber-prompt', tagId: 'img_terminal_jailbreak', rationale: '匹配黑客终端流式打字与乱码解构意象。' },
    { pattern: /hook|pdoom|foom|boom|future/i, plugin: 'kinetic-hook', tagId: 'img_exponential_foom', rationale: '匹配副歌高能冲击与同心圆激波环扩散意象。' },
    { pattern: /flops|odometer|scale|speed|number|climb/i, plugin: 'ascent-odometer', tagId: 'style_industrial_tech', rationale: '匹配算力天梯机械滚轮指数级飙升意象。' },
    { pattern: /fuse|spark|burn|lit|fire|match/i, plugin: 'fuse-spark', tagId: 'img_singularity', rationale: '匹配动态引信燃烧火花轨迹与音高追踪意象。' },
    { pattern: /loom|matrix|ilya|tensor|thread|weave/i, plugin: 'matrix-loom', tagId: 'style_quantum_spacetime', rationale: '匹配高维张量矩阵交织与注意力网络意象。' },
    { pattern: /loss|drop|boss|gradient|descent/i, plugin: 'acoustic-loss', tagId: 'style_tactical_telemetry', rationale: '匹配声学通量损失函数折线图谱意象。' },
    { pattern: /press|heavy|machine|hammer|stamp/i, plugin: 'kinetic-press', tagId: 'style_industrial_tech', rationale: '匹配工业机械重压字模冲击意象。' },
  ];

  for (const rule of SEMANTIC_RULES) {
    if (rule.pattern.test(text)) {
      const tag = [...SEMANTIC_IMAGERIES, ...AESTHETIC_STYLES].find(t => t.id === rule.tagId) || SEMANTIC_IMAGERIES[0]!;
      return {
        plugin: rule.plugin,
        matchedTag: tag,
        confidence: 0.92,
        rationale: rule.rationale,
      };
    }
  }

  // 默认兜底
  return {
    plugin: 'typography',
    matchedTag: AESTHETIC_STYLES[0]!,
    confidence: 0.75,
    rationale: '未命中强意象关键词，启用清晰高对比自适应动力学排版。',
  };
}

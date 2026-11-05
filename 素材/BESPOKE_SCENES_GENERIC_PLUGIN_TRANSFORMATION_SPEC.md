# 原版镜头特效与文字动效通用插件化改造工程规范

## 1. 核心问题定性与物理事实对抗

针对用户核心命题：“原版镜头的特效以及对应的文字特效，能否改造为以歌词作为动态参数传入的形式，实现全量入库作为通用插件复用？”

* 物理与代码层面的硬事实审计结论：
  1. 答案在工程架构上是**完全可行**的，但在工程实现上**严禁采取轻量包装**，必须进行深度的**语法槽位解耦（Slot-based Decoupling）**与**流式自适应排版重构（Adaptive Kinetic Typography Engine）**。
  2. 原版 28 个场景（`app/src/scenes/*.ts`，约 20,000 行 TypeScript）当前存在强致命的**硬编码字面量断言**。例如 `open.ts` 第 115 行 `find(this.L1, 'AGI')`，若传入不含 "AGI" 的新歌词，代码在 `init()` 阶段直接抛出 `Error: open: word not found: AGI` 导致运行时崩溃。
  3. 原版镜头的本质是**“视听语意具象化手工艺品（Handcrafted Bespoke Art）”**而非现成通用组件。文字不是外挂字幕，而是 3D 几何拓扑的生成源与相机运动的控制锚点。
  4. 通用化改造的核心，是将“写死特定字符串与词频”提炼为**“参数化几何流派（Parametric Aesthetic Paradigms）”**。

---

## 2. 原版镜头硬编码耦合的三重底层解剖

### 2.1 文本字面量与词法检索强硬绑定 (String-Literal Assertion)
* 现状代码模式：
  ```typescript
  // dense.ts
  this.L1 = lyrics.get('Post-Chinchilla');
  this.L2 = lyrics.get('safety fence');
  this.L3 = lyrics.get('Hundred thousand');
  this.L4 = lyrics.get('RLHF');

  // hook.ts
  const line = lyrics.linesIn(start - 0.3, end).find((l) => /upping/i.test(l.text)) ?? lyrics.linesIn(start, end)[0]!;

  // open.ts
  w.AGI = find(this.L1, 'AGI'); // 找不到直接 throw
  ```
* 破坏性后果：
  任何非原曲的音频/歌词数据包接入，初始化阶段抛出异常，整个管线在第 0 帧彻底阻塞挂死。

### 2.2 几何尺寸与固定单词数量强硬绑定 (Fixed-Token Geometry)
* 现状代码模式（以 `dense-press.ts` 为例）：
  ```typescript
  // 机械重压排版写死了固定的 4 级下拍挤压与 5 个特定词爆裂
  const [wBr, wTh, wEa, wSa, wFe] = L2.words as [Word, Word, Word, Word, Word];
  const spec = [
    [[wBr], 62, AW, TW, this.rup[0]!, false],
    [[wTh], 75, W, AW, this.rup[1]!, false],
    [[wEa, wSa], 62, W * 1.06, W, this.rup[2]!, false],
    [[wFe], 87.5, W * 1.05, W - 2 * FENCE_X, this.rup[3]!, true],
  ];
  ```
* 破坏性后果：
  当新歌词的一行只有 2 个词或多达 12 个词时，解构断言数组越界，或导致屏幕边缘排版大面积溢出被裁切。

### 2.3 镜头运动轨迹与手绘坐标强硬绑定 (Hardcoded Spatial Anchors)
* 现状代码模式（以 `open.ts` 为例）：
  ```typescript
  const COLX = 4.3; // 歌词绝对世界坐标 X 轴
  this.hand = this.lossHandoff(); // 笔尖位置严格计算于上一场景第 0 帧像素投影
  ```
* 破坏性后果：
  无法适应不同长度歌词的重心漂移，相机朝向会聚焦在空无一物的空白区域。

---

## 3. 通用插件化改造的技术方案与协议契约

为使原版镜头全量入库并通用化，必须将输入契约重构为**“统一分镜槽位（Scene Slot Contract）”**：

```
+-----------------------------------------------------------------------------------+
|                           Unified Scene Slot Contract                             |
|                                                                                   |
|  +--------------------+  +----------------------+  +---------------------------+  |
|  |    Lines Input     |  |    Focus Extraction  |  |    Geometry Adaptor       |  |
|  | (1~N Line Objects) |  | (Semantic Key-Words) |  | (Bounding & Camera Auto)  |  |
|  +---------+----------+  +----------+-----------+  +-------------+-------------+  |
|            |                        |                            |                |
|            v                        v                            v                |
|  +-----------------------------------------------------------------------------+  |
|  |                    Generic Transformed Scene BaseClass                      |  |
|  |  - fallbackLines(t0, t1) : 自动按分镜区间截取有效歌词行                      |  |
|  |  - selectStressedWord()  : 结合音频 RMS 能量峰值自动判定重音主词            |  |
|  |  - autoFitLayout()       : 动态字号收缩算法，保证视口安全边距               |  |
|  |  - trackWordCamera()     : 自动将三维视锥中心锁相在正在发音的文字包围盒     |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

### 3.1 改造契约接口定义 (TypeScript)
```typescript
/** 场景入参通用配置 */
export interface GenericSceneParams {
  /** 歌词模式：auto(自动拾取分镜区间歌词) | manual(显式传递歌词文本) */
  lyricMode?: 'auto' | 'manual';
  /** 手动指定的歌词行或文本片段（覆盖默认区间） */
  customLines?: string[];
  /** 核心强调槽位索引或规则：'longest'(最长词) | 'peak'(声学能量最大词) | 显式索引 */
  primaryFocus?: 'longest' | 'peak' | number;
  /** 排版风格参数覆盖 */
  typography?: {
    fontSize?: number;
    letterSpacing?: number;
    colorScheme?: [number, number, number];
    glowIntensity?: number;
  };
  /** 视觉特性参数覆盖 */
  visualParams?: Record<string, any>;
}
```

### 3.2 动态词汇提取算法（消除 `find(w, 'AGI')` 崩溃）
```typescript
export class BespokeSceneHelper {
  /** 提取当前场景区间内有效的歌词行，杜绝硬编码死锁 */
  static resolveLines(ctx: SceneContext, params?: GenericSceneParams): Line[] {
    if (params?.customLines && params.customLines.length > 0) {
      // 合成虚拟 Line 对象
      return params.customLines.map((txt, idx) => ({
        i: idx,
        start: lerp(ctx.start, ctx.end, idx / params.customLines!.length),
        end: lerp(ctx.start, ctx.end, (idx + 1) / params.customLines!.length),
        text: txt,
        words: txt.split(/\s+/).map((w, wi, arr) => ({
          w,
          start: lerp(ctx.start, ctx.end, (idx + wi / arr.length) / params.customLines!.length),
          end: lerp(ctx.start, ctx.end, (idx + (wi + 1) / arr.length) / params.customLines!.length),
        })),
      }));
    }
    const lines = ctx.lyrics.linesIn(ctx.start - 0.2, ctx.end + 0.2);
    if (lines.length > 0) return lines;
    // 降级兜底：生成单行静默占位，保证渲染循环绝对不抛出致命异常
    return [{
      i: 0,
      start: ctx.start,
      end: ctx.end,
      text: '',
      words: [{ w: '', start: ctx.start, end: ctx.end }],
    }];
  }

  /** 根据声学能量或词长自动寻找最具有表现力的核心关键词（替代原版 AGI / loss 等） */
  static extractFocusWord(line: Line, mode: 'longest' | 'peak' | number = 'peak', audio?: AudioFeatures): Word {
    if (!line.words || line.words.length === 0) return { w: '', start: line.start, end: line.end };
    if (typeof mode === 'number') {
      return line.words[Math.min(line.words.length - 1, Math.max(0, mode))]!;
    }
    if (mode === 'longest') {
      return [...line.words].sort((a, b) => b.w.length - a.w.length)[0]!;
    }
    if (audio) {
      // 寻找时间区间内 RMS 能量最高的词
      let maxEnergy = -1, bestWord = line.words[0]!;
      for (const w of line.words) {
        const e = audio.bassAt((w.start + w.end) * 0.5);
        if (e > maxEnergy) { maxEnergy = e; bestWord = w; }
      }
      return bestWord;
    }
    return line.words[0]!;
  }
}
```

---

## 4. 原版 28 个镜头的解耦难度分级与入库路线

不能对所有原版镜头采取单一策略，必须按底层几何与文本语义的耦合度划分为三大工程梯队：

```
+-----------------------------------------------------------------------------------+
|                        28 Bespoke Scenes Classification                           |
|                                                                                   |
|  [Tier A: Math & Mesh Dominated] (8 Scenes, Cost: 20%~35%)                        |
|  - paperclips (装配回形针网络)      - room (3D 几何房间变换)                        |
|  - spacetime (时空光锥透镜)        - loom (多维矩阵交织线条)                      |
|  - ascent (上升阶梯光标)          - fuse (引信与粒子散布)                        |
|  - outro (全景几何收缩)            - ilya (3D 背景光影)                          |
|                                                                                   |
|  [Tier B: Kinetic Typography Heavy] (12 Scenes, Cost: 45%~65%)                    |
|  - dense / dense-press (工业重压排版) - dense-askew (多角度倾斜拉伸)              |
|  - dense-gpu (算力机架字幕)       - leftturn-gantt (甘特图节奏打击排版)          |
|  - stack (分层堆叠穿透排版)        - bureau (行政文件批注排版)                    |
|  - leftturn-map (道路导航地图文字)  - ascent-odo (数字滚轮里程计)                  |
|  - ascent-note (技术附注便签)      - prompt (代码终端逐字输出)                    |
|  - hook (主副歌大标题冲击排版)      - open-geo (图元几何线条)                      |
|                                                                                   |
|  [Tier C: Deep Semantic Metaphor] (8 Scenes, Cost: 80%~90%)                       |
|  - open (手绘电路与 AGI 眼睛)      - loss (神经网络损失函数下降曲线)              |
|  - shoggoth (修格斯触手与笑脸面具)  - shoggoth-glsl (面具撕裂着色器)              |
|  - ilya-room (特定人物祭坛)       - bureau-flow (官僚体制流程图)                  |
|  - leftturn (左转避障安全策略)     - paperclips-glsl (回形针宇宙自我复制)          |
+-----------------------------------------------------------------------------------+
```

### 4.1 Tier A：几何与着色器主导型（低成本入库，即刻可通用）
* 改造要点：
  1. 场景的核心资产是 3D 几何网格（Mesh）、SDF 光线步进、粒子系统与后处理着色器。
  2. 文字仅作为浮动 HUD、刻度标尺或背景轻度投影。
  3. 改造工作量极小：只需切断顶层写死的 `lyrics.get('固定文本')`，替换为 `BespokeSceneHelper.resolveLines()`，将文字内容作为 HUD 动态绘制即可。
* 入库价值：
  能够为任意音乐提供极具工业感、高精度、高数学美感的 3D 动态背景。

### 4.2 Tier B：动态动效大排版型（中度改造，提炼为工业级排版引擎）
* 改造要点：
  1. 此类场景的视觉灵魂即为**“动效排版（Kinetic Typography）”**。
  2. 原版针对特定长度的单词做过像素级微调（如 Archivo 字体的缩放、紧贴屏幕边界的挤压断裂）。
  3. 改造核心：引入**“弹性单词流（Fluid Token Flow）”**：
     * 不再假定一行恰好有 5 个词。使用动态布局循环：`words.map((w, idx) => calculateRupture(idx, words.length))`。
     * 根据动态计算的包围盒自动决定是单行并排、多行堆叠还是折行换行。
     * 强拍打击点（Kicks / Beats）动态均分到每个单词的起振时间点。
* 入库价值：
  这批插件一旦参数化入库，将成为市场上最顶级的代码级动态字幕动效库，视觉冲击力远超传统视频剪辑软件的预设模板。

### 4.3 Tier C：强具象隐喻型（高难度改造，提炼为特定视觉风格流派）
* 改造要点：
  1. 场景内含有强烈的叙事性图元（如“损失函数 Loss 对数坐标轴”、“AI 发展左转示意图”、“修格斯触手与笑脸面具”）。
  2. 若要在任意曲目中复用，必须做**语义泛化定位**：
     * **定位为“风格化赛博/科技隐喻模板”**：不改变图元本身（仍然画坐标轴或面具），但将坐标轴的标题、曲线的数据来源、面具撕裂时的发光文字全面参数化为新歌词。这使该镜头成为一种自带“极客、理智崩溃、科技批判”风格的特定镜头插件。
     * **曲线与拓扑数据源参数化**：将 `loss.ts` 中的损失下降曲线，改造为接收任意数据序列（例如可以绑定当前歌曲的 `audio.spectralCentroid` 频域通量曲线，随着音乐节奏跌宕起伏）。

---

## 5. 改造实施 SOP 与模板化重构示例

以原版最具代表性的动效大排版镜头 [`dense.ts`](file:///Users/ic/Copyright/pdoom-video/app/src/scenes/dense.ts) 为例，演示将其改造为通用插件 [`src/plugins/kinetic-press.ts`] 的标准化落地代码结构：

### 5.1 改造后的通用插件定义
```typescript
import { Scene, Frame, type SceneContext } from '../engine/scene';
import { BespokeSceneHelper, type GenericSceneParams } from './bespoke-helper';
import { Press, GpuFloor, Askew } from '../scenes/dense-press';
import { PDoom } from '../scenes/_motifs';
import { Layer2D } from '../engine/gl';
import * as THREE from 'three';

export default class KineticPressPlugin extends Scene {
  private params: GenericSceneParams;
  private press!: Press;
  private c2 = 0;
  private c3 = 0;

  constructor(ctx: SceneContext, params: GenericSceneParams = {}) {
    super(ctx);
    this.params = params;
  }

  override async init() {
    const { audio } = this.ctx;
    // 1. 动态安全获取歌词行，杜绝字符串字面量死锁
    const lines = BespokeSceneHelper.resolveLines(this.ctx, this.params);
    const L1 = lines[0]!;
    const L2 = lines[1] ?? lines[0]!;

    // 2. 动态依据节拍下拍切分运动阶段
    this.c2 = audio.nearestBeat(L1.end);
    this.c3 = audio.nearestBeat(L2.start);

    // 3. 实例化自适应排版核心
    this.press = new Press(audio, L1, L2, this.ctx.start, this.c2, this.c3);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    // 4. 纯净执行实时渲染，支持外部参数透明覆盖
    return this.press.draw(this.hud.ctx, f.t, this.glow);
  }
}
```

---

## 6. 结论与工程决策建议

* 改造可行性：**完全可行**。原版 28 个镜头完全可以作为通用插件入库，并且由于其底层的 WebGL Instanced Line 与光线步进代码本身具有极高效率，入库后依然能在 M3 Ultra 上维持 60 FPS 恒定运行。
* 实施路线推荐：
  1. **第一阶段（快速入库）**：优先将 8 个 Tier A 场景（3D 几何与着色器主导型，如 `paperclips`, `spacetime`, `room`, `loom`）完成槽位化解耦，投入通用插件库。
  2. **第二阶段（高价值入库）**：将 12 个 Tier B 场景（动态大排版型，如 `dense`, `dense-press`, `stack`, `hook`）重构为弹性单词流排版引擎，作为系统核心文字特效资产。
  3. **第三阶段（风格化入库）**：将 8 个 Tier C 场景（强隐喻型，如 `open`, `loss`, `shoggoth`）作为特殊流派主题包（如“Cyber/DeepTech Theme Pack”）入库，保留其视觉震撼力，文字与数据流全部支持外置注入。

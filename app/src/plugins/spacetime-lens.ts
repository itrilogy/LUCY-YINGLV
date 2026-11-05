import { Scene, Frame, type SceneCtx } from '../engine/scene';
import { BespokeSceneHelper, type GenericSceneParams } from './bespoke-helper';
import { W, H, Layer2D, FSPass } from '../engine/gl';
import { clamp } from '../engine/util';
import type { Line } from '../engine/lyrics';
import * as THREE from 'three';

const LENS_FRAG = /* glsl */ `
uniform vec2 uRes;
uniform float uTime;
uniform float uBass;
uniform float uPulse;
uniform vec3 uColor;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float r = length(uv);
  
  // Einstein Ring & Gravitational Lensing Deflection
  float mass = 0.08 + uBass * 0.06 + uPulse * 0.04;
  vec2 distortedUv = uv - (uv / max(r * r, 0.008)) * mass * 0.15;
  
  // Starfield Grid Curvature
  vec2 grid = abs(fract(distortedUv * 16.0) - 0.5);
  float lines = smoothstep(0.04, 0.01, min(grid.x, grid.y));
  
  // Gravitational Wave Ripples
  float wave = sin(r * 35.0 - uTime * 6.0) * exp(-r * 3.5);
  
  // Color Composition
  vec3 col = vec3(0.015, 0.02, 0.035);
  col += uColor * lines * 0.35 * exp(-r * 1.5);
  col += uColor * max(0.0, wave) * (0.4 + uBass * 0.8);
  
  // Black Hole Event Horizon Core
  float horizon = smoothstep(mass * 0.6, mass * 0.8, r);
  col *= horizon;
  
  // Accretion Disk Glow
  float disk = exp(-abs(r - mass * 1.2) * 18.0) * (0.8 + uBass * 1.5);
  col += vec3(1.0, 0.8, 0.5) * disk * 0.8;
  
  fragColor = vec4(col, 1.0);
}
`;

/**
 * 时空引力透镜通用插件 (Spacetime Gravitational Lens Plugin)
 * 提取自原版 spacetime.ts，具备全屏引力透镜弯曲、黑洞视界激波环与轨道歌词投影。
 */
export default class SpacetimeLensPlugin extends Scene {
  private params: GenericSceneParams;
  private hud = new Layer2D();
  private fsPass: FSPass;
  private sceneLines: Line[] = [];
  private theme: [number, number, number] = [0.4, 0.7, 1.0]; // 宇宙深蓝

  constructor(ctx: SceneCtx, params: GenericSceneParams = {}) {
    super(ctx);
    this.params = { ...params, ...(ctx.params ?? {}) };
    if (this.params.themeColor) this.theme = this.params.themeColor;

    this.fsPass = new FSPass(LENS_FRAG, {
      uRes: { value: new THREE.Vector2(W, H) },
      uTime: { value: 0 },
      uBass: { value: 0 },
      uPulse: { value: 0 },
      uColor: { value: new THREE.Vector3(...this.theme) },
    });
  }

  override async init() {
    this.sceneLines = BespokeSceneHelper.resolveLines(this.ctx, this.params);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer } = this.ctx;
    const t = f.t;
    const bass = f.a.bass;

    // 1. 更新着色器参数 (通过 .u 访问)
    const u = this.fsPass.u;
    u.uTime!.value = t;
    u.uBass!.value = bass;
    u.uPulse!.value = Math.max(0, Math.sin(t * 4.0)) * bass;
    u.uColor!.value.set(...this.theme);

    // 2. 渲染全屏引力透镜背景
    this.fsPass.render(renderer, out);

    // 3. 绘制引力环轨道环绕歌词 (支持多句轮播与无人声自动隐去)
    this.hud.clear();
    const ctx2d = this.hud.ctx;
    const lyric = BespokeSceneHelper.getRenderableLyric(this.sceneLines, t);

    if (!f.suppressLyrics && !lyric.isInstrumental && lyric.text && lyric.opacity > 0.01) {
      const fontSize = this.params.fontSize ?? 44;
      const autoSize = BespokeSceneHelper.autoFitSize(lyric.text.length, W - 300, fontSize);

      ctx2d.save();
      ctx2d.globalAlpha = lyric.opacity;
      ctx2d.translate(W * 0.5, H * 0.5 + lyric.offsetY);

      // 歌词轻微环绕旋转
      const angle = (t * 0.15) % (Math.PI * 2);
      ctx2d.rotate(angle * 0.05);

      ctx2d.font = `600 ${autoSize}px "Archivo", "Helvetica Neue", sans-serif`;
      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';

      // 发音发光文字
      ctx2d.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx2d.fillText(lyric.text, 0, 3);

      const grad = ctx2d.createLinearGradient(-W * 0.35, 0, W * 0.35, 0);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(clamp(lyric.progress, 0.05, 0.95), `rgb(${Math.floor(this.theme[0] * 255)}, ${Math.floor(this.theme[1] * 255)}, ${Math.floor(this.theme[2] * 255)})`);
      grad.addColorStop(1.0, 'rgba(160, 190, 240, 0.25)');

      ctx2d.fillStyle = grad;
      ctx2d.fillText(lyric.text, 0, 0);

      // 外圈事件视界数据标尺
      ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx2d.lineWidth = 1;
      ctx2d.beginPath();
      ctx2d.arc(0, 0, 240 + bass * 30, 0, Math.PI * 2);
      ctx2d.stroke();

      ctx2d.font = '500 12px "Courier New", monospace';
      ctx2d.fillStyle = 'rgba(200, 230, 255, 0.6)';
      ctx2d.fillText(`RS: 2GM/c² // LINE ${lyric.lineIndex + 1}/${lyric.totalLines} // CURVATURE: ${(1.0 + bass * 2.5).toFixed(3)}`, 0, 275);

      ctx2d.restore();
    }

    // 4. 叠加 HUD (使用 screen 模式)
    this.ctx.comp.draw(renderer, this.hud.upload(), out, { mode: 'screen' });
    return undefined;
  }
}

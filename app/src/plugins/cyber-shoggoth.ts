// CyberShoggothPlugin: 高维张量不可名状生物与笑脸面具插件
// 呈现高维多重波动触手场、笑脸面具与 X 光透视、死神之眼目标检测框与流式歌词嵌入
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { BespokeSceneHelper, type GenericSceneParams } from './bespoke-helper';
import type { Line } from '../engine/lyrics';

export default class CyberShoggothPlugin extends Scene {
  pass = new FSPass(/* glsl */ `
    uniform float t;
    uniform float beat;
    uniform float kick;
    uniform float snare;
    uniform vec3 eldritchColor;

    // 2D 旋转矩阵
    mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

    // 高维分形噪声与不可名状触手场
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 4; i++) {
        v += a * sin(p.x * 2.0 + t * 1.5) * cos(p.y * 2.0 - t * 1.2);
        p = rot(0.5) * p * 2.1;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * vec2(${W}.0, ${H}.0)) / ${H}.0;

      // 触手波动场
      vec2 q = uv * 3.0;
      q += vec2(fbm(q + vec2(0.0, t * 0.4)), fbm(q + vec2(1.5, -t * 0.3)));
      float tentacle = abs(sin(length(q) * 4.0 - beat * 1.5));
      tentacle = smoothstep(0.4, 0.02, tentacle);

      // 中心笑脸面具外轮廓 (Mask Silhouette)
      float maskDist = length(uv - vec2(0.0, 0.05)) - 0.32;
      float maskEdge = smoothstep(0.02, 0.0, abs(maskDist));
      float insideMask = step(maskDist, 0.0);

      // X-Ray 扫描线 (随着节拍左右横扫)
      float scanX = sin(t * 2.5) * 0.35;
      float scanLine = smoothstep(0.02, 0.0, abs(uv.x - scanX)) * insideMask;

      vec3 col = vec3(0.012, 0.015, 0.02);
      // 触手深渊色彩
      col += eldritchColor * tentacle * (0.8 + kick * 0.9);

      // 面具内部呈现半透明白瓷质感，或被 X-Ray 穿透露出背后触手
      if (insideMask > 0.5) {
        float reveal = smoothstep(-0.1, 0.1, uv.x - scanX);
        vec3 maskCol = mix(vec3(0.85, 0.88, 0.92), eldritchColor * 1.4, reveal * 0.85);
        col = mix(col, maskCol, 0.75);
      }

      // 边缘发光
      col += vec3(0.9, 0.95, 1.0) * maskEdge * 1.2;
      col += vec3(1.0, 0.3, 0.2) * scanLine * 2.0;

      fragColor = vec4(col, 1.0);
    }
  `, {
    t: { value: 0 },
    beat: { value: 0 },
    kick: { value: 0 },
    snare: { value: 0 },
    eldritchColor: { value: LIN.acid },
  });

  layer = new Layer2D();
  lines: Line[] = [];

  override async init() {
    this.lines = BespokeSceneHelper.resolveLines(this.ctx, this.ctx.params as GenericSceneParams);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const params = this.ctx.params || {};
    const colKey = params.color ?? 'acid';
    const mainCol = LIN[colKey as keyof typeof LIN] ?? LIN.acid;

    this.pass.u.t!.value = f.t;
    this.pass.u.beat!.value = f.beat;
    this.pass.u.kick!.value = f.a.kick;
    this.pass.u.snare!.value = f.a.snare;
    this.pass.u.eldritchColor!.value = mainCol;

    this.pass.render(renderer, out);

    // 绘制目标检测框与死神之眼 (Shinigami Detection Tags)
    const ctx2d = this.layer.ctx;
    this.layer.clear();

    const boxCount = 3;
    ctx2d.font = font(F.mono(500), 16);
    for (let bi = 0; bi < boxCount; bi++) {
      const bx = W / 2 + Math.sin(f.t * 2 + bi * 2.1) * 320;
      const by = H / 2 - 120 + Math.cos(f.t * 1.5 + bi * 1.8) * 160;
      const bw = 90 + Math.sin(f.t + bi) * 15;
      const bh = 55;

      ctx2d.strokeStyle = rgba('acid', 0.75 + f.a.kick * 0.25);
      ctx2d.lineWidth = 1.5;
      ctx2d.strokeRect(bx - bw / 2, by - bh / 2, bw, bh);

      if (f.layerIndex === 0) {
        ctx2d.fillStyle = rgba('acid', 0.9);
        ctx2d.fillText(`EYE_${bi} [CONF 99.4%]`, bx - bw / 2, by - bh / 2 - 6);
      }
    }

    // 原生歌词流式嵌入
    if (this.lines.length > 0) {
      const lyric = BespokeSceneHelper.getRenderableLyric(this.lines, f.t);
      BespokeSceneHelper.renderEmbeddedLyric(ctx2d, lyric, f, {
        cx: W / 2,
        cy: H / 2 + 130,
        baseSize: params.fontSize ?? 54,
        color: 'rgba(235, 255, 240, ',
        activeColor: 'rgba(255, 60, 60, ',
        glowColor: 'rgba(160, 255, 80, ',
        telemetryTag: 'SHOGGOTH LATERAL VIEW // UNMASKED',
      });
    }

    comp.draw(renderer, this.layer.upload(), out, { mode: 'normal' });

    return {
      bloom: 0.7 + f.a.kick * 0.5,
      zoom: 1.0 + f.a.kick * 0.04,
    };
  }
}

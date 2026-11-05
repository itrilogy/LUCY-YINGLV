// BeatTunnelSDFPlugin: 3D 光线步进几何回廊插件
// 摄像机位移严格锁定节拍推进，小节重拍瞬态触发切角与高亮，内置歌词卡拉OK流式渲染
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LIN } from '../engine/palette';
import { BespokeSceneHelper, type GenericSceneParams } from './bespoke-helper';
import type { Line } from '../engine/lyrics';

export default class BeatTunnelSDFPlugin extends Scene {
  pass = new FSPass(/* glsl */ `
    uniform float t;
    uniform float beat;
    uniform float barPhase;
    uniform float kick;
    uniform float snare;
    uniform vec3 accentColor;

    // 旋转矩阵
    mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

    // 3D 距离场: 方形重复隧道
    float sdBox(vec2 p, vec2 b) {
      vec2 d = abs(p) - b;
      return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    }

    float map(vec3 p) {
      // 沿 Z 轴重复
      vec3 q = p;
      q.z = mod(q.z + 1.0, 2.0) - 1.0;
      float tunnel = -sdBox(p.xy, vec2(1.2, 0.8));
      float ribs = sdBox(q.xy, vec2(1.25, 0.85)) - 0.04;
      return max(tunnel, -ribs);
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * vec2(${W}.0, ${H}.0)) / ${H}.0;

      // 小节第一拍卡点瞬态扭转
      float roll = floor(beat / 4.0) * 0.785398 + smoothstep(0.0, 0.15, barPhase) * 0.785398;
      uv = rot(roll) * uv;

      // 摄像机推进
      vec3 ro = vec3(0.0, 0.0, beat * 1.5);
      vec3 rd = normalize(vec3(uv, 1.2));

      // 光线步进 (最大 48 步，保证 60fps 实时流畅)
      float depth = 0.0;
      float d = 0.0;
      for (int i = 0; i < 48; i++) {
        vec3 p = ro + rd * depth;
        d = map(p);
        if (abs(d) < 0.005 || depth > 25.0) break;
        depth += d * 0.75;
      }

      vec3 col = vec3(0.015, 0.015, 0.02);
      if (depth < 25.0) {
        vec3 p = ro + rd * depth;
        // 沿结构线条发光
        float edge = smoothstep(0.02, 0.0, abs(d));
        float fog = exp(-depth * 0.12);
        
        vec3 glow = mix(vec3(0.3, 0.3, 0.35), accentColor * (1.0 + kick * 1.5), edge);
        col = glow * fog;

        // 小军鼓瞬态反色高光
        col += accentColor * snare * 0.4 * fog;
      }

      fragColor = vec4(col, 1.0);
    }
  `, {
    t: { value: 0 },
    beat: { value: 0 },
    barPhase: { value: 0 },
    kick: { value: 0 },
    snare: { value: 0 },
    accentColor: { value: LIN.signal },
  });

  layer = new Layer2D();
  lines: Line[] = [];

  override async init() {
    this.lines = BespokeSceneHelper.resolveLines(this.ctx, this.ctx.params as GenericSceneParams);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const params = this.ctx.params || {};
    const colKey = params.color ?? 'signal';
    const mainCol = LIN[colKey as keyof typeof LIN] ?? LIN.signal;

    this.pass.u.t!.value = f.t;
    this.pass.u.beat!.value = f.beat;
    this.pass.u.barPhase!.value = f.barPhase;
    this.pass.u.kick!.value = f.a.kick;
    this.pass.u.snare!.value = f.a.snare;
    this.pass.u.accentColor!.value = mainCol;

    this.pass.render(renderer, out);

    // 原生歌词流式嵌入与节拍震颤
    if (this.lines.length > 0) {
      const lyric = BespokeSceneHelper.getRenderableLyric(this.lines, f.t);
      this.layer.clear();
      BespokeSceneHelper.renderEmbeddedLyric(this.layer.ctx, lyric, f, {
        cx: W / 2,
        cy: H / 2,
        baseSize: params.fontSize ?? 54,
        color: 'rgba(230, 245, 255, ',
        activeColor: 'rgba(255, 90, 90, ',
        glowColor: 'rgba(255, 80, 50, ',
        telemetryTag: 'HYPER-TUNEL // FLOPs VECTOR',
      });
      comp.draw(renderer, this.layer.upload(), out, { mode: 'normal' });
    }

    return {
      bloom: 0.65 + f.a.kick * 0.4,
      zoom: 1.0 + f.a.kick * 0.04,
    };
  }
}


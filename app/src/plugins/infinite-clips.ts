// InfiniteClipsPlugin: 几何回形针自增殖物理网络插件
// 接收音乐能量触发回形针复制裂变、高维几何翻转与卡拉OK歌词嵌入
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LIN } from '../engine/palette';
import { BespokeSceneHelper, type GenericSceneParams } from './bespoke-helper';
import type { Line } from '../engine/lyrics';

export default class InfiniteClipsPlugin extends Scene {
  pass = new FSPass(/* glsl */ `
    uniform float t;
    uniform float beat;
    uniform float barPhase;
    uniform float kick;
    uniform float snare;
    uniform vec3 metalColor;

    // 旋转矩阵
    mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

    // 回形针胶囊体与环状距离场近似
    float sdTorus(vec3 p, vec2 t) {
      vec2 q = vec2(length(p.xz) - t.x, p.y);
      return length(q) - t.y;
    }

    float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
      vec3 pa = p - a, ba = b - a;
      float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
      return length(pa - ba * h) - r;
    }

    // 单个回形针距离场
    float clipSDF(vec3 p) {
      float d = sdCapsule(p, vec3(-0.4, -0.8, 0.0), vec3(-0.4, 0.8, 0.0), 0.05);
      d = min(d, sdCapsule(p, vec3(0.4, -0.6, 0.0), vec3(0.4, 0.6, 0.0), 0.05));
      d = min(d, sdCapsule(p, vec3(0.0, -0.7, 0.0), vec3(0.0, 0.7, 0.0), 0.05));
      d = min(d, sdTorus(p - vec3(-0.2, 0.8, 0.0), vec2(0.2, 0.05)));
      d = min(d, sdTorus(p - vec3(0.2, -0.6, 0.0), vec2(0.2, 0.05)));
      return d;
    }

    float map(vec3 p) {
      // 空间无限周期重复晶格 (Infinite Replicating Lattice)
      vec3 q = p;
      float cell = 2.4;
      vec3 id = floor((q + cell * 0.5) / cell);
      q = mod(q + cell * 0.5, cell) - cell * 0.5;

      // 每个回形针按 ID 发生微弱自转，并在下拍产生机械震动
      q.xy = rot(id.x * 0.5 + id.z * 0.3 + t * 0.8) * q.xy;
      q.yz = rot(id.y * 0.4 + beat * 0.2) * q.yz;

      return clipSDF(q);
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * vec2(${W}.0, ${H}.0)) / ${H}.0;

      // 摄像机沿 Z 轴匀速穿行在回形针海洋中
      vec3 ro = vec3(0.0, 0.0, -beat * 2.0);
      vec3 rd = normalize(vec3(uv, 1.1));

      // 伴随鼓点旋转镜头视角
      rd.xy = rot(sin(t * 0.3) * 0.15) * rd.xy;

      float depth = 0.0;
      float d = 0.0;
      for (int i = 0; i < 40; i++) {
        vec3 p = ro + rd * depth;
        d = map(p);
        if (d < 0.005 || depth > 20.0) break;
        depth += d * 0.8;
      }

      vec3 col = vec3(0.01, 0.015, 0.02);
      if (depth < 20.0) {
        vec3 p = ro + rd * depth;
        // 金属表面高光反射与边缘发光
        vec3 n = normalize(vec3(
          map(p + vec3(0.001, 0, 0)) - map(p - vec3(0.001, 0, 0)),
          map(p + vec3(0, 0.001, 0)) - map(p - vec3(0, 0.001, 0)),
          map(p + vec3(0, 0, 0.001)) - map(p - vec3(0, 0, 0.001))
        ));

        vec3 lightDir = normalize(vec3(0.5, 0.8, -0.4));
        float diff = max(dot(n, lightDir), 0.0);
        float spec = pow(max(dot(reflect(-lightDir, n), -rd), 0.0), 32.0);
        float rim = pow(1.0 - max(dot(-rd, n), 0.0), 3.0);

        float fog = exp(-depth * 0.14);
        vec3 clipColor = mix(metalColor, vec3(1.0, 0.95, 0.8), spec * 0.8);
        col = (clipColor * (diff * 0.6 + 0.2) + vec3(rim) * 0.8) * fog;
        col += metalColor * kick * 0.4 * fog;
      }

      fragColor = vec4(col, 1.0);
    }
  `, {
    t: { value: 0 },
    beat: { value: 0 },
    barPhase: { value: 0 },
    kick: { value: 0 },
    snare: { value: 0 },
    metalColor: { value: LIN.bone },
  });

  layer = new Layer2D();
  lines: Line[] = [];

  override async init() {
    this.lines = BespokeSceneHelper.resolveLines(this.ctx, this.ctx.params as GenericSceneParams);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const params = this.ctx.params || {};
    const colKey = params.color ?? 'bone';
    const mainCol = LIN[colKey as keyof typeof LIN] ?? LIN.bone;

    this.pass.u.t!.value = f.t;
    this.pass.u.beat!.value = f.beat;
    this.pass.u.barPhase!.value = f.barPhase;
    this.pass.u.kick!.value = f.a.kick;
    this.pass.u.snare!.value = f.a.snare;
    this.pass.u.metalColor!.value = mainCol;

    this.pass.render(renderer, out);

    // 原生嵌入歌词排版
    if (this.lines.length > 0) {
      const lyric = BespokeSceneHelper.getRenderableLyric(this.lines, f.t);
      this.layer.clear();
      BespokeSceneHelper.renderEmbeddedLyric(this.layer.ctx, lyric, f, {
        cx: W / 2,
        cy: H / 2 + 20,
        baseSize: params.fontSize ?? 54,
        color: 'rgba(240, 240, 245, ',
        activeColor: 'rgba(255, 215, 80, ',
        glowColor: 'rgba(255, 180, 50, ',
        telemetryTag: 'RECURSIVE PAPERCLIPS // LATTICE v3.8',
      });
      comp.draw(renderer, this.layer.upload(), out, { mode: 'normal' });
    }

    return {
      bloom: 0.7 + f.a.kick * 0.45,
      zoom: 1.0 + f.a.kick * 0.03,
    };
  }
}

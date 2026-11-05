// FuseSparkPlugin: 动态引信火花、音高曲线与能量引爆插件
// 呈现引信燃烧火花飞溅轨迹、音频实时音高曲线扫描、爆炸激波与流式歌词嵌入
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { BespokeSceneHelper, type GenericSceneParams } from './bespoke-helper';
import type { Line } from '../engine/lyrics';

export default class FuseSparkPlugin extends Scene {
  pass = new FSPass(/* glsl */ `
    uniform float t;
    uniform float beat;
    uniform float kick;
    uniform float snare;
    uniform float high;
    uniform vec3 sparkColor;

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * vec2(${W}.0, ${H}.0)) / ${H}.0;

      // 沿水平方向推进的引信线
      float fuseProg = fract(t * 0.15) * 2.0 - 1.0;
      float distToFuse = abs(uv.y - sin(uv.x * 3.0 + t * 2.0) * 0.12);
      float fuseLine = smoothstep(0.008, 0.0, distToFuse) * step(uv.x, fuseProg);

      // 引信燃烧头火花爆炸点
      vec2 sparkPos = vec2(fuseProg, sin(fuseProg * 3.0 + t * 2.0) * 0.12);
      float distToHead = length(uv - sparkPos);
      float sparkHead = exp(-distToHead * 18.0) * (2.0 + kick * 3.0);

      // 火花飞溅粒子模拟
      float particles = 0.0;
      for (int i = 0; i < 12; i++) {
        float angle = fract(sin(float(i) * 12.9898 + t * 8.0) * 43758.5453) * 6.28318;
        float dist = fract(t * 3.0 + float(i) * 0.08) * (0.2 + kick * 0.25);
        vec2 p = sparkPos + vec2(cos(angle), sin(angle)) * dist;
        particles += smoothstep(0.012, 0.0, length(uv - p)) * exp(-dist * 5.0);
      }

      vec3 col = vec3(0.015, 0.01, 0.015);
      col += vec3(0.2, 0.2, 0.25) * fuseLine;
      col += sparkColor * (sparkHead + particles * 2.5);
      col += vec3(1.0, 0.85, 0.4) * sparkHead * 0.8;

      fragColor = vec4(col, 1.0);
    }
  `, {
    t: { value: 0 },
    beat: { value: 0 },
    kick: { value: 0 },
    snare: { value: 0 },
    high: { value: 0 },
    sparkColor: { value: LIN.ember },
  });

  layer = new Layer2D();
  lines: Line[] = [];

  override async init() {
    this.lines = BespokeSceneHelper.resolveLines(this.ctx, this.ctx.params as GenericSceneParams);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const params = this.ctx.params || {};
    const colKey = params.color ?? 'ember';
    const mainCol = LIN[colKey as keyof typeof LIN] ?? LIN.ember;

    this.pass.u.t!.value = f.t;
    this.pass.u.beat!.value = f.beat;
    this.pass.u.kick!.value = f.a.kick;
    this.pass.u.snare!.value = f.a.snare;
    this.pass.u.high!.value = f.a.high;
    this.pass.u.sparkColor!.value = mainCol;

    this.pass.render(renderer, out);

    // 绘制示波器音高网格与流式歌词（仅独奏层显示左上角遥测文本）
    const ctx2d = this.layer.ctx;
    this.layer.clear();

    if (f.layerIndex === 0) {
      ctx2d.font = font(F.mono(500), 16);
      ctx2d.fillStyle = rgba('ember', 0.9);
      ctx2d.fillText(`ACOUSTIC PITCH TRACKER // LIT THE FUSE`, 60, 80);
      ctx2d.fillText(`FREQUENCY HARMONICS: [HIGH: ${f.a.high.toFixed(3)}] [KICK: ${f.a.kick.toFixed(3)}]`, 60, 105);
    }

    if (this.lines.length > 0) {
      const lyric = BespokeSceneHelper.getRenderableLyric(this.lines, f.t);
      BespokeSceneHelper.renderEmbeddedLyric(ctx2d, lyric, f, {
        cx: W / 2,
        cy: H / 2 + 80,
        baseSize: params.fontSize ?? 54,
        color: 'rgba(255, 240, 230, ',
        activeColor: 'rgba(255, 60, 20, ',
        glowColor: 'rgba(255, 120, 20, ',
        telemetryTag: 'IGNITION POINT // DETONATION IMMINENT',
      });
    }

    comp.draw(renderer, this.layer.upload(), out, { mode: 'normal' });

    return {
      bloom: 0.6 + f.a.kick * 0.3,
      zoom: 1.0 + f.a.kick * 0.03,
      flash: f.tout > 0.5 ? 0 : (f.a.kick > 0.92 ? 0.15 : 0),
    };
  }
}

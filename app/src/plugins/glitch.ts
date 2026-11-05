// OscilloscopeGlitchPlugin: 示波器波形与 CRT 终端故障插件
// 接收高频能量与镲片瞬态触发扫描线错位、色散、终端字符跳变与流式歌词接入
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { BespokeSceneHelper, type GenericSceneParams } from './bespoke-helper';
import type { Line } from '../engine/lyrics';

export default class OscilloscopeGlitchPlugin extends Scene {
  pass = new FSPass(/* glsl */ `
    uniform float t;
    uniform float high;
    uniform float hat;
    uniform vec3 phosphorColor;

    void main() {
      vec2 uv = gl_FragCoord.xy / vec2(${W}.0, ${H}.0);

      // CRT 行扫描线
      float scan = sin(uv.y * 540.0) * 0.5 + 0.5;
      float scanLine = pow(scan, 1.5) * 0.25;

      // 镲片高频瞬态行位移故障 (Glitch)
      float glitch = step(0.96, fract(sin(floor(uv.y * 30.0) + t * 40.0) * 43758.5453)) * hat;
      uv.x += glitch * 0.04 * (fract(sin(t * 10.0) * 100.0) - 0.5);

      // 模拟示波器居中正弦波带
      float wave = sin(uv.x * 20.0 + t * 12.0) * (0.05 + high * 0.15);
      float distToWave = abs(uv.y - 0.5 - wave);
      float beam = smoothstep(0.015, 0.0, distToWave);

      vec3 col = vec3(0.01, 0.015, 0.01);
      col += phosphorColor * beam * (1.2 + hat * 1.0);
      col -= scanLine;

      fragColor = vec4(max(col, vec3(0.0)), 1.0);
    }
  `, {
    t: { value: 0 },
    high: { value: 0 },
    hat: { value: 0 },
    phosphorColor: { value: LIN.acid },
  });

  layer = new Layer2D();
  lines: Line[] = [];

  override async init() {
    this.lines = BespokeSceneHelper.resolveLines(this.ctx, this.ctx.params as GenericSceneParams);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const params = this.ctx.params || {};

    this.pass.u.t!.value = f.t;
    this.pass.u.high!.value = f.a.high;
    this.pass.u.hat!.value = f.a.hat;
    this.pass.render(renderer, out);

    // 终端遥测与歌词流式渲染（仅独奏层显示左上角遥测文本）
    const ctx2d = this.layer.ctx;
    this.layer.clear();
    if (f.layerIndex === 0) {
      ctx2d.font = font(F.mono(500), 20);
      ctx2d.fillStyle = rgba('acid', 0.85);

      const title = params.title ?? 'OSCILLOSCOPE TELEMETRY';
      ctx2d.fillText(`[ ${title} ]`, 60, 80);
      ctx2d.fillText(`BEAT: ${f.beat.toFixed(2)}  |  BAR: ${f.bar.toFixed(1)}`, 60, 110);
      ctx2d.fillText(`ENERGY: RMS=${f.a.rms.toFixed(3)} HIGH=${f.a.high.toFixed(3)}`, 60, 140);
      if (f.a.hat > 0.4) {
        ctx2d.fillStyle = rgba('signal', 1.0);
        ctx2d.fillText(`>>> TRANSIENT SPIKE DETECTED <<<`, 60, 170);
      }
    }

    if (this.lines.length > 0) {
      const lyric = BespokeSceneHelper.getRenderableLyric(this.lines, f.t);
      BespokeSceneHelper.renderEmbeddedLyric(ctx2d, lyric, f, {
        cx: W / 2,
        cy: H / 2 + 30,
        baseSize: params.fontSize ?? 54,
        color: 'rgba(210, 255, 120, ',
        activeColor: 'rgba(255, 255, 255, ',
        glowColor: 'rgba(180, 255, 50, ',
        telemetryTag: 'GLITCH OSCILLATOR MATRIX',
      });
    }

    comp.draw(renderer, this.layer.upload(), out, { mode: 'normal' });

    return {
      bloom: 0.6,
      ca: 1.5 + f.a.hat * 3.5,
    };
  }
}


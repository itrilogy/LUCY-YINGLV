// AscentOdometerPlugin: 指数级算力里程计与天梯天网插件
// 呈现机械/电子滚轮数字里程表、参数量指数飙升、天梯阶梯上升与卡拉OK歌词嵌入
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { BespokeSceneHelper, type GenericSceneParams } from './bespoke-helper';
import type { Line } from '../engine/lyrics';

export default class AscentOdometerPlugin extends Scene {
  pass = new FSPass(/* glsl */ `
    uniform float t;
    uniform float beat;
    uniform float kick;
    uniform float high;
    uniform vec3 accentColor;

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * vec2(${W}.0, ${H}.0)) / ${H}.0;

      // 阶梯上升天梯网格透视
      float speed = beat * 1.2;
      float gridY = fract(uv.y * 8.0 - speed);
      float lineY = smoothstep(0.06, 0.0, abs(gridY - 0.5));

      float gridX = fract(uv.x * 12.0);
      float lineX = smoothstep(0.04, 0.0, abs(gridX - 0.5));

      float ladder = max(lineY * 0.7, lineX * 0.4) * exp(-abs(uv.x) * 2.2);

      // 背景渐变
      vec3 col = vec3(0.01, 0.015, 0.025);
      col += accentColor * ladder * (1.0 + kick * 1.2);

      // 中心垂直光柱
      float beam = exp(-abs(uv.x) * 16.0) * (0.2 + kick * 0.4);
      col += accentColor * beam;

      fragColor = vec4(col, 1.0);
    }
  `, {
    t: { value: 0 },
    beat: { value: 0 },
    kick: { value: 0 },
    high: { value: 0 },
    accentColor: { value: LIN.ember },
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
    this.pass.u.high!.value = f.a.high;
    this.pass.u.accentColor!.value = mainCol;

    this.pass.render(renderer, out);

    // 机械里程表与数字滚轮绘制
    const ctx2d = this.layer.ctx;
    this.layer.clear();

    const odoY = 220;
    const exponent = 18 + f.beat * 0.35 + f.a.kick * 0.2;
    const flopsVal = Math.pow(10, (exponent % 1) * 3) * 1.45;
    const expInt = Math.floor(exponent);

    // 里程表背景框
    ctx2d.save();
    ctx2d.translate(W / 2, odoY);
    ctx2d.fillStyle = 'rgba(10, 15, 20, 0.85)';
    ctx2d.strokeStyle = rgba('ember', 0.8);
    ctx2d.lineWidth = 2.5;
    ctx2d.beginPath();
    ctx2d.roundRect(-420, -50, 840, 100, 10);
    ctx2d.fill();
    ctx2d.stroke();

    // 绘制数字滚轮
    ctx2d.font = font(F.mono(700), 52);
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'middle';
    ctx2d.fillStyle = rgba('paper', 1.0);

    const odoString = `FLOPs: ${flopsVal.toFixed(2)}e+${expInt}`;
    ctx2d.fillText(odoString, 0, 0);

    // 顶部状态小字（仅独奏模式显示）
    if (f.layerIndex === 0) {
      ctx2d.font = font(F.mono(500), 16);
      ctx2d.fillStyle = rgba('ember', 0.9);
      ctx2d.fillText(`ASCENT ODOMETER // EXPONENTIAL RUNAWAY ACCELERATION`, 0, -68);
    }

    ctx2d.restore();

    // 原生歌词流式嵌入
    if (this.lines.length > 0) {
      const lyric = BespokeSceneHelper.getRenderableLyric(this.lines, f.t);
      BespokeSceneHelper.renderEmbeddedLyric(ctx2d, lyric, f, {
        cx: W / 2,
        cy: H / 2 + 100,
        baseSize: params.fontSize ?? 54,
        color: 'rgba(255, 245, 230, ',
        activeColor: 'rgba(255, 170, 40, ',
        glowColor: 'rgba(255, 120, 20, ',
        telemetryTag: 'COMPUTE THRESHOLD // BREAKOUT',
      });
    }

    comp.draw(renderer, this.layer.upload(), out, { mode: 'normal' });

    return {
      bloom: 0.65 + f.a.kick * 0.4,
      zoom: 1.0 + f.a.kick * 0.04,
    };
  }
}

// DenseClusterPlugin: 十万级 GPU 算力集群机架与光纤脉冲插件
// 呈现高密度服务器机架透视阵列、GPU 活动指示灯流、高频光纤脉冲与流式歌词嵌入
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { BespokeSceneHelper, type GenericSceneParams } from './bespoke-helper';
import type { Line } from '../engine/lyrics';

export default class DenseClusterPlugin extends Scene {
  pass = new FSPass(/* glsl */ `
    uniform float t;
    uniform float beat;
    uniform float kick;
    uniform float hat;
    uniform vec3 rackColor;

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * vec2(${W}.0, ${H}.0)) / ${H}.0;

      // 透视数据中心走廊 (Server Corridor)
      float z = 1.0 / max(abs(uv.x) + 0.12, 0.02);
      float y = uv.y * z;
      float marchZ = z + beat * 1.5;

      // 机架垂直单元格与横向插槽
      float slotY = fract(y * 3.5);
      float rackSlot = smoothstep(0.06, 0.0, abs(slotY - 0.5));

      float unitZ = fract(marchZ * 0.7);
      float rackDiv = smoothstep(0.05, 0.0, abs(unitZ - 0.5));

      // GPU LED 指示灯闪烁矩阵
      vec2 ledCoord = floor(vec2(y * 12.0, marchZ * 6.0));
      float ledRand = fract(sin(dot(ledCoord, vec2(12.9898, 78.233))) * 43758.5453);
      float ledActive = step(0.55, fract(ledRand + t * 3.0)) * (0.6 + hat * 0.8);

      vec3 col = vec3(0.02, 0.03, 0.05);

      // 机架深度环境辉光 (Deep Server Room Atmospheric Radiance)
      col += vec3(0.0, 0.15, 0.3) * exp(-z * 0.08);

      // 机架结构线条 (清晰立体的机柜轮廓)
      float edge = max(rackSlot * 0.8, rackDiv * 0.6);
      col += rackColor * edge * exp(-z * 0.06) * 1.4;

      // GPU LED 阵列发光与光纤通信脉冲
      vec3 ledCol = mix(rackColor * 0.9, vec3(0.0, 1.0, 0.5), fract(ledRand * 3.0));
      col += ledCol * ledActive * exp(-z * 0.08) * 1.8;

      // 地面与天花板透视反射
      float floorReflect = smoothstep(0.4, 0.5, abs(uv.y)) * exp(-z * 0.1);
      col += rackColor * floorReflect * (0.3 + kick * 0.4);

      // 底鼓冲击触发机架通电闪烁
      col += rackColor * kick * 0.35 * exp(-z * 0.05);

      // 视心灭点平滑截断，保持文字视域对比度，同时背景完全可见
      float centerDamp = smoothstep(0.02, 0.25, length(uv * vec2(1.0, 1.6)));
      col *= mix(0.7, 1.0, centerDamp);

      // 硬性 HDR 亮度截断，防止 Bloom 过曝
      col = clamp(col, vec3(0.0), vec3(1.4));

      fragColor = vec4(col, 1.0);
    }
  `, {
    t: { value: 0 },
    beat: { value: 0 },
    kick: { value: 0 },
    hat: { value: 0 },
    rackColor: { value: LIN.signal },
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
    this.pass.u.kick!.value = f.a.kick;
    this.pass.u.hat!.value = f.a.hat;
    this.pass.u.rackColor!.value = mainCol;

    this.pass.render(renderer, out);

    // 集群遥测标题与流式歌词（仅独奏层显示左上角遥测文本）
    const ctx2d = this.layer.ctx;
    this.layer.clear();

    if (f.layerIndex === 0) {
      ctx2d.font = font(F.mono(600), 18);
      ctx2d.fillStyle = rgba('cyan', 0.9);
      ctx2d.fillText(`DATA CENTER // 100,000 H100 GPU CLUSTER ACTIVE`, 60, 80);
      ctx2d.fillText(`FABRIC BANDWIDTH: 3.2 Tbps/NODE  |  POWER: 120 MW`, 60, 110);
    }

    if (this.lines.length > 0) {
      const lyric = BespokeSceneHelper.getRenderableLyric(this.lines, f.t);
      BespokeSceneHelper.renderEmbeddedLyric(ctx2d, lyric, f, {
        cx: W / 2,
        cy: H / 2,
        baseSize: params.fontSize ?? 54,
        color: 'rgba(230, 255, 255, ',
        activeColor: 'rgba(50, 255, 180, ',
        glowColor: 'rgba(0, 220, 255, ',
        telemetryTag: 'DGX SUPERPOD // DISTRIBUTED GRADIENTS',
      });
    }

    comp.draw(renderer, this.layer.upload(), out, { mode: 'normal' });

    return {
      bloom: 0.65 + f.a.kick * 0.4,
      zoom: 1.0 + f.a.kick * 0.03,
    };
  }
}

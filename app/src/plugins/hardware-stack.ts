// HardwareStackPlugin: 硅晶圆半导体到计算堆栈插件
// 提取自原版 stack.ts / stack-kit.ts，呈现 300mm 硅晶圆微观纳米光刻蚀刻、Die 封装阵列与宏观计算堆栈
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { BespokeSceneHelper, type GenericSceneParams } from './bespoke-helper';
import type { Line } from '../engine/lyrics';

export default class HardwareStackPlugin extends Scene {
  pass = new FSPass(/* glsl */ `
    uniform float t;
    uniform float beat;
    uniform float kick;
    uniform float hat;
    uniform vec3 emeraldColor;

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * vec2(${W}.0, ${H}.0)) / ${H}.0;

      // 300mm 硅晶圆圆形边缘 (Silicon Wafer Contour)
      float waferR = 0.44;
      float waferDist = length(uv) - waferR;
      float waferEdge = smoothstep(0.01, 0.0, abs(waferDist));
      float insideWafer = step(waferDist, 0.0);

      // Die 芯片网格切割道 (Scribe Lines Grid)
      vec2 dieUv = uv * 14.0;
      vec2 dieGrid = abs(fract(dieUv) - 0.5);
      float gridLine = smoothstep(0.06, 0.0, min(dieGrid.x, dieGrid.y)) * insideWafer;

      // 极紫外光 (EUV) 步进扫描光刻光带 (Photolithography Stepper Beam)
      float stepY = fract(t * 0.4);
      float beamDist = abs(uv.y - (stepY - 0.5));
      float euvBeam = smoothstep(0.05, 0.0, beamDist) * insideWafer * (0.8 + hat * 0.5);

      // 晶体管栅极微观彩虹干涉色 (Wafer Interference Thin-Film)
      float irid = sin(length(uv) * 32.0 - t * 2.0) * 0.5 + 0.5;
      vec3 iridCol = mix(vec3(0.05, 0.35, 0.25), vec3(0.0, 0.8, 0.6), irid);

      vec3 col = vec3(0.015, 0.02, 0.025);
      // 晶圆底材反射
      col += iridCol * insideWafer * 0.45;
      // 切割道网格辉光
      col += emeraldColor * gridLine * (0.6 + kick * 0.6);
      // 光刻步进光带
      col += vec3(0.2, 0.9, 1.0) * euvBeam * 1.2;
      // 晶圆金属倒角外轮廓
      col += emeraldColor * waferEdge * 1.5;

      // 底鼓冲击机架电流
      col += emeraldColor * kick * 0.12;

      fragColor = vec4(col, 1.0);
    }
  `, {
    t: { value: 0 },
    beat: { value: 0 },
    kick: { value: 0 },
    hat: { value: 0 },
    emeraldColor: { value: [0.05, 0.85, 0.55] as [number, number, number] },
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
    this.pass.u.beat!.value = f.beat;
    this.pass.u.kick!.value = f.a.kick;
    this.pass.u.hat!.value = f.a.hat;
    this.pass.render(renderer, out);

    const ctx2d = this.layer.ctx;
    this.layer.clear();

    // 绘制芯片堆栈架构标尺 (仅独奏层显示，避免多层叠加时左上/右上文字重叠)
    if (f.layerIndex === 0) {
      ctx2d.font = font(F.mono(700), 16);
      ctx2d.fillStyle = 'rgba(0, 230, 180, 0.9)';
      ctx2d.fillText(`SILICON SUBSTRATE // 300mm MONOCRYSTALLINE WAFER`, 80, 80);

      ctx2d.font = font(F.mono(500), 13);
      ctx2d.fillStyle = 'rgba(140, 200, 180, 0.75)';
      ctx2d.fillText(`EUV WAVELENGTH: 13.5 nm  |  TRANSISTOR GATE DENSITY: 1.8e11 / cm²`, 80, 105);
      ctx2d.fillText(`STEPPER SPEED: 120 WAFERS/HR  |  RETICLE EXPOSURE: ACTIVE`, 80, 126);

      // 右侧计算堆栈拓扑层级 (Stack Hierarchy Indicator)
      const stackLayers = [
        'L5 // DISTRIBUTED GRADIENTS (DATA CENTER)',
        'L4 // NVLINK / NVSWITCH FABRIC (NODE)',
        'L3 // H100 DIE + HBM3 MEMORY STACK',
        'L2 // TSMC 4N CO-WOS INTERPOSER',
        'L1 // SILICON TRANSISTOR SUBSTRATE (ACTIVE)',
      ];
      stackLayers.forEach((layerName, i) => {
        const isCurrent = i === 4;
        ctx2d.fillStyle = isCurrent ? 'rgba(0, 255, 180, 0.95)' : 'rgba(100, 140, 130, 0.45)';
        ctx2d.font = font(F.mono(isCurrent ? 700 : 500), 12);
        ctx2d.fillText(layerName, W - 380, 80 + i * 24);
        if (isCurrent) {
          ctx2d.fillRect(W - 400, 71 + i * 24, 8, 8);
        }
      });
    }

    // 原生歌词流式嵌入
    if (this.lines.length > 0) {
      const lyric = BespokeSceneHelper.getRenderableLyric(this.lines, f.t);
      BespokeSceneHelper.renderEmbeddedLyric(ctx2d, lyric, f, {
        cx: W / 2,
        cy: H / 2,
        baseSize: params.fontSize ?? 54,
        color: 'rgba(240, 255, 250, ',
        activeColor: 'rgba(0, 255, 180, ',
        glowColor: 'rgba(0, 220, 160, ',
        telemetryTag: 'COMPUTE HARDWARE STACK // TRANSISTOR SCALE',
      });
    }

    comp.draw(renderer, this.layer.upload(), out, { mode: 'normal' });

    return {
      bloom: 0.6 + f.a.kick * 0.35,
      zoom: 1.0 + f.a.kick * 0.02,
    };
  }
}

import * as THREE from 'three';
import { type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, W, H } from '../engine/gl';
import { LIN } from '../engine/palette';
import { LyricAwarePlugin } from './lyric-aware-plugin';

export default class ReactiveTerrainPlugin extends LyricAwarePlugin {
  pass = new FSPass(/* glsl */ `
    uniform float t;
    uniform float beat;
    uniform float bass;
    uniform float kick;
    uniform vec3 gridColor;
    uniform vec3 horizonColor;

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * vec2(${W}.0, ${H}.0)) / ${H}.0;
      
      // 灭点透视投影 (y < 0 为下半部分地面)
      if (uv.y >= 0.05) {
        // 天空微光背景
        float sky = exp(-uv.y * 4.0);
        fragColor = vec4(horizonColor * sky * 0.15, 1.0);
        return;
      }

      // 透视投影映射到地面平面 (Z 深度，X 侧向)
      float py = -uv.y + 0.05;
      float z = 1.0 / max(py, 0.001);
      float x = uv.x * z;

      // 随着音乐节拍向前行进
      float forward = beat * 1.5 + t * 0.5;
      float gz = z + forward;

      // 地形波形: 正弦波叠合低频 Bass 反应
      float wave = sin(x * 1.2) * cos(gz * 0.8) * (0.4 + bass * 1.5);
      float shock = sin(length(vec2(x, z - 3.0)) * 2.0 - t * 8.0) * kick * 0.5;
      float height = wave + shock;

      // 坐标网格线 (基于 fwidth 锐化抗锯齿)
      vec2 grid = abs(fract(vec2(x * 0.5, gz * 0.5) - 0.5) - 0.5) / fwidth(vec2(x * 0.5, gz * 0.5));
      float line = 1.0 - min(min(grid.x, grid.y), 1.0);

      // 深度雾效衰减
      float fog = exp(-z * 0.08);

      // 颜色混合: 网格线高光 + 地平线微光
      vec3 col = mix(vec3(0.02, 0.02, 0.03), gridColor * (1.0 + kick * 0.8), line) * fog;
      col += horizonColor * exp(-abs(uv.y - 0.05) * 20.0) * (0.3 + bass * 0.4);

      fragColor = vec4(col, 1.0);
    }
  `, {
    t: { value: 0 },
    beat: { value: 0 },
    bass: { value: 0 },
    kick: { value: 0 },
    gridColor: { value: LIN.signal },
    horizonColor: { value: LIN.ember },
  });

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const params = this.ctx.params || {};
    const colKey = params.color ?? 'signal';
    const mainCol = LIN[colKey as keyof typeof LIN] ?? LIN.signal;

    this.pass.u.t!.value = f.t;
    this.pass.u.beat!.value = f.beat;
    this.pass.u.bass!.value = f.a.bass;
    this.pass.u.kick!.value = f.a.kick;
    this.pass.u.gridColor!.value = mainCol;

    this.pass.render(renderer, out);

    // 原生歌词流式嵌入 (基类封装，自动处理器乐期优化与透明度渐变)
    this.renderLyrics(f, out, {
      cx: W / 2,
      cy: H / 2 - 40,
      baseSize: params.fontSize ?? 54,
      color: 'rgba(255, 255, 255, ',
      activeColor: 'rgba(255, 210, 60, ',
      glowColor: 'rgba(255, 100, 20, ',
      telemetryTag: 'ACOUSTIC SYNTHESIS // TERRAIN MATRIX',
    });

    return {
      bloom: 0.6 + f.a.kick * 0.4,
      shake: [f.a.kick * 2.5 * (Math.sin(f.t * 60) > 0 ? 1 : -1), 0],
    };
  }
}


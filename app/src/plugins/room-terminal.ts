// RoomTerminalPlugin: 全息控制室与多维监视器阵列插件
// 呈现 4 分屏闭路电视监视、3D 线框旋转模型、实时声学频谱柱状图、雷达极坐标扫描、代码流与流式歌词嵌入
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { BespokeSceneHelper, type GenericSceneParams } from './bespoke-helper';
import type { Line } from '../engine/lyrics';

export default class RoomTerminalPlugin extends Scene {
  pass = new FSPass(/* glsl */ `
    uniform float t;
    uniform float beat;
    uniform float kick;
    uniform float hat;
    uniform vec3 amberColor;

    void main() {
      vec2 uv = gl_FragCoord.xy / vec2(${W}.0, ${H}.0);
      vec2 cUv = (gl_FragCoord.xy - 0.5 * vec2(${W}.0, ${H}.0)) / ${H}.0;

      // 4 分屏监视器粗黑分界线 (Monitor Bezel Grid)
      float divX = smoothstep(0.008, 0.0, abs(uv.x - 0.5));
      float divY = smoothstep(0.012, 0.0, abs(uv.y - 0.5));
      float bezel = max(divX, divY);

      // CRT 细微水平扫描线 (Scanlines)
      float scan = sin(uv.y * 540.0 + t * 5.0) * 0.5 + 0.5;

      // 监视器荧光底色 (Amber & Phosphor Dark Glow)
      vec3 col = vec3(0.02, 0.024, 0.03);
      col += amberColor * 0.05;
      col += vec3(0.02) * scan;

      // 4 窗口内部边缘渐暗阴影 (Vignette per Screen)
      vec2 subUv = fract(uv * 2.0);
      float subVig = smoothstep(0.0, 0.12, subUv.x) * smoothstep(1.0, 0.88, subUv.x) *
                     smoothstep(0.0, 0.12, subUv.y) * smoothstep(1.0, 0.88, subUv.y);
      col *= (0.6 + 0.4 * subVig);

      // 监视器高亮边框发光
      col += amberColor * bezel * 0.6;

      // 底鼓触发全屏警戒微冲
      col += vec3(0.12, 0.02, 0.02) * kick;

      fragColor = vec4(col, 1.0);
    }
  `, {
    t: { value: 0 },
    beat: { value: 0 },
    kick: { value: 0 },
    hat: { value: 0 },
    amberColor: { value: LIN.ember },
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

    const halfW = W / 2;
    const halfH = H / 2;

    // --- 窗口 1 (左上)：3D 旋转线框收容舱 (Containment Core Wireframe) ---
    {
      const cx = halfW * 0.5, cy = halfH * 0.5;
      ctx2d.save();
      ctx2d.translate(cx, cy);
      const rot = f.t * 0.8;
      const size = 90 + f.a.kick * 25;

      ctx2d.strokeStyle = 'rgba(0, 230, 255, 0.6)';
      ctx2d.lineWidth = 1.5;

      // 旋转八面体投影
      for (let ring = 0; ring < 3; ring++) {
        ctx2d.beginPath();
        const rRad = rot + ring * (Math.PI / 3);
        const rx = Math.cos(rRad) * size;
        const ry = Math.sin(rRad * 0.7) * size * 0.6;
        ctx2d.ellipse(0, 0, Math.abs(rx), size * 0.8, rRad * 0.5, 0, Math.PI * 2);
        ctx2d.stroke();
      }

      ctx2d.font = font(F.mono(600), 13);
      ctx2d.fillStyle = 'rgba(0, 230, 255, 0.85)';
      ctx2d.fillText(`[CAM_01: SUPERCONDUCTING VACUUM CORE]`, -cx + 40, -cy + 40);
      ctx2d.fillText(`STABILITY: 99.98%  |  SPIN: ${(rot % 6.28).toFixed(2)} rad/s`, -cx + 40, -cy + 60);

      // REC 红色闪烁标记
      if (Math.sin(f.t * 6.0) > 0) {
        ctx2d.fillStyle = 'rgba(255, 50, 40, 0.9)';
        ctx2d.beginPath();
        ctx2d.arc(cx - 60, -cy + 45, 6, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.fillText(`REC`, cx - 45, -cy + 49);
      }
      ctx2d.restore();
    }

    // --- 窗口 2 (右上)：实时声学音频频谱跳动 (Real-time Audio Spectrum Equalizer) ---
    {
      const ox = halfW + 40, oy = 80;
      ctx2d.font = font(F.mono(600), 13);
      ctx2d.fillStyle = 'rgba(255, 180, 50, 0.85)';
      ctx2d.fillText(`[CAM_02: ACOUSTIC HARMONICS & NEURAL FLUX]`, ox, 50);

      const numBars = 32;
      const barW = (halfW - 80) / numBars;
      for (let i = 0; i < numBars; i++) {
        const normX = i / numBars;
        // 模拟各频段响应（低频受 kick 驱动，中频受 bass，高频受 hat）
        const freqWeight = Math.sin(normX * Math.PI);
        const energy = (normX < 0.3 ? f.a.kick * 1.5 : (normX < 0.7 ? f.a.bass * 1.2 : f.a.hat * 1.8)) * freqWeight;
        const noise = Math.sin(i * 1.7 + f.t * 12.0) * 0.2 + 0.2;
        const barH = Math.min(180, Math.max(8, (energy + noise) * 160));

        const grad = ctx2d.createLinearGradient(0, halfH - 40, 0, halfH - 40 - barH);
        grad.addColorStop(0, 'rgba(255, 140, 0, 0.4)');
        grad.addColorStop(0.8, 'rgba(255, 220, 50, 0.85)');
        grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.95)');

        ctx2d.fillStyle = grad;
        ctx2d.fillRect(ox + i * barW, halfH - 40 - barH, barW - 3, barH);
      }
    }

    // --- 窗口 3 (左下)：极坐标警戒雷达扫描 (Tactical Radar Sweep) ---
    {
      const cx = halfW * 0.5, cy = halfH + halfH * 0.5;
      ctx2d.save();
      ctx2d.translate(cx, cy);

      const radius = 130;
      ctx2d.strokeStyle = 'rgba(50, 255, 120, 0.4)';
      ctx2d.lineWidth = 1.5;

      // 同心圆环
      for (let r = 1; r <= 3; r++) {
        ctx2d.beginPath();
        ctx2d.arc(0, 0, (radius / 3) * r, 0, Math.PI * 2);
        ctx2d.stroke();
      }
      // 十字准星
      ctx2d.beginPath();
      ctx2d.moveTo(-radius, 0); ctx2d.lineTo(radius, 0);
      ctx2d.moveTo(0, -radius); ctx2d.lineTo(0, radius);
      ctx2d.stroke();

      // 旋转扫描针
      const sweepAngle = (f.t * 2.2) % (Math.PI * 2);
      ctx2d.beginPath();
      ctx2d.moveTo(0, 0);
      ctx2d.lineTo(Math.cos(sweepAngle) * radius, Math.sin(sweepAngle) * radius);
      ctx2d.strokeStyle = 'rgba(100, 255, 160, 0.9)';
      ctx2d.lineWidth = 2.5;
      ctx2d.stroke();

      // 雷达目标点
      const targets = [
        { dist: 80, ang: 1.2 }, { dist: 110, ang: 3.8 }, { dist: 50, ang: 5.1 }
      ];
      targets.forEach((tg) => {
        const tx = Math.cos(tg.ang) * tg.dist;
        const ty = Math.sin(tg.ang) * tg.dist;
        ctx2d.fillStyle = 'rgba(255, 40, 40, 0.9)';
        ctx2d.beginPath();
        ctx2d.arc(tx, ty, 4, 0, Math.PI * 2);
        ctx2d.fill();
      });

      ctx2d.font = font(F.mono(600), 13);
      ctx2d.fillStyle = 'rgba(80, 255, 140, 0.85)';
      ctx2d.fillText(`[CAM_03: ACTIVE SONAR & TARGET TRACKING]`, -cx + 40, -halfH * 0.5 + 40);
      ctx2d.fillText(`TARGETS DETECTED: 03 // LOCK CONFIRMED`, -cx + 40, -halfH * 0.5 + 60);

      ctx2d.restore();
    }

    // --- 窗口 4 (右下)：十六进制神经权重日志 (Hex Matrix Terminal Stream) ---
    {
      const ox = halfW + 40, oy = halfH + 40;
      ctx2d.font = font(F.mono(600), 13);
      ctx2d.fillStyle = 'rgba(255, 80, 80, 0.85)';
      ctx2d.fillText(`[CAM_04: RECEPTIVE FIELD WEIGHT LOGS]`, ox, oy);

      ctx2d.font = font(F.mono(400), 12);
      ctx2d.fillStyle = 'rgba(220, 200, 180, 0.55)';
      for (let row = 0; row < 7; row++) {
        const hex1 = Math.floor(Math.sin(f.t * 3.0 + row) * 1000000 + 5000000).toString(16).toUpperCase();
        const hex2 = Math.floor(Math.cos(f.t * 2.0 + row * 2) * 1000000 + 8000000).toString(16).toUpperCase();
        ctx2d.fillText(`0x${(row * 0x1000).toString(16).padStart(4, '0')}: ${hex1} ${hex2}  |  ACTIVATION SIGMOID: ${(0.85 + Math.sin(row + f.t) * 0.1).toFixed(4)}`, ox, oy + 30 + row * 22);
      }
    }

    // --- 中央安全歌词显示（清晰轮廓高光，背景 4 窗口生动活跃） ---
    if (this.lines.length > 0) {
      const lyric = BespokeSceneHelper.getRenderableLyric(this.lines, f.t);
      BespokeSceneHelper.renderEmbeddedLyric(ctx2d, lyric, f, {
        cx: W / 2,
        cy: H / 2,
        baseSize: params.fontSize ?? 54,
        color: 'rgba(255, 255, 255, ',
        activeColor: 'rgba(255, 200, 50, ',
        glowColor: 'rgba(255, 140, 20, ',
        telemetryTag: 'CONTROL ROOM // QUAD CCTV MATRIX ONLINE',
      });
    }

    comp.draw(renderer, this.layer.upload(), out, { mode: 'normal' });

    return {
      bloom: 0.6 + f.a.kick * 0.4,
      zoom: 1.0 + f.a.kick * 0.02,
    };
  }
}

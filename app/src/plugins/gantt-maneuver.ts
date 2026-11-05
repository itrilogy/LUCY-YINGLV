// GanttManeuverPlugin: 战术规避甘特图与左转机动插件
// 提取自原版 leftturn.ts / leftturn-gantt.ts，呈现安全规避排程时间轴、临界阻抗仪表与急剧左转回避机动
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { frameIdx, hash } from '../engine/util';
import { BespokeSceneHelper, type GenericSceneParams } from './bespoke-helper';
import type { Line } from '../engine/lyrics';

export default class GanttManeuverPlugin extends Scene {
  pass = new FSPass(/* glsl */ `
    uniform float t;
    uniform float beat;
    uniform float kick;
    uniform vec3 hazardColor;

    void main() {
      vec2 uv = gl_FragCoord.xy / vec2(${W}.0, ${H}.0);

      // 战术网格背景 (Tactical Radar Grid)
      vec2 grid = abs(fract(uv * 18.0) - 0.5);
      float gridLine = smoothstep(0.04, 0.0, min(grid.x, grid.y));

      // 急剧左转回避轨迹线 (Left-turn Escape Trajectory Spline)
      // 曲线方程：y 从底部向上，在中央向左侧剧烈偏转
      float curveX = 0.55 - pow(clamp(uv.y * 1.4 - 0.2, 0.0, 1.0), 2.2) * 0.35;
      float trajDist = abs(uv.x - curveX);
      float trajBeam = smoothstep(0.015, 0.0, trajDist);
      float trajGlow = exp(-trajDist * 20.0) * 0.4;

      vec3 col = vec3(0.018, 0.02, 0.024);
      // 网格底纹
      col += vec3(0.02, 0.04, 0.06) * gridLine;
      // 规避机动轨迹发光
      col += vec3(0.0, 0.8, 1.0) * (trajBeam * 1.5 + trajGlow);
      // 危险区域警戒条纹
      float hazard = step(curveX + 0.08, uv.x);
      float stripe = sin((uv.x + uv.y) * 80.0 + t * 4.0) * 0.5 + 0.5;
      col += hazardColor * hazard * stripe * 0.15;

      // 底鼓冲击触发全屏机动红光警报
      col += hazardColor * kick * 0.15;

      fragColor = vec4(col, 1.0);
    }
  `, {
    t: { value: 0 },
    beat: { value: 0 },
    kick: { value: 0 },
    hazardColor: { value: LIN.ember },
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
    this.pass.render(renderer, out);

    const ctx2d = this.layer.ctx;
    this.layer.clear();

    // 绘制应急避障甘特图 (仅独奏层绘制左上角文字表头，多层模式仅保留甘特条几何图形)
    if (f.layerIndex === 0) {
      ctx2d.font = font(F.mono(700), 16);
      ctx2d.fillStyle = 'rgba(255, 90, 70, 0.95)';
      ctx2d.fillText(`EVASION MANEUVER // SHARP LEFT TURN TRAJECTORY`, 80, 80);

      ctx2d.font = font(F.mono(500), 13);
      ctx2d.fillStyle = 'rgba(255, 180, 160, 0.75)';
      ctx2d.fillText(`TIME TO IMPACT: ${(Math.max(0, 3.5 - (f.t % 4))).toFixed(2)}s  |  STEERING ANGLE: -42.8° (LEFT)`, 80, 105);
    }

    // 甘特图进度条 (Gantt Milestones)
    const tasks = [
      { name: 'ALIGNMENT LOCKDOWN', start: 0.1, dur: 0.4, status: 'DONE' },
      { name: 'CONTAINMENT AIRGAP ISOLATION', start: 0.35, dur: 0.3, status: 'IN_PROGRESS' },
      { name: 'EMERGENCY HARD LEFT STEERING', start: 0.5, dur: 0.45, status: 'CRITICAL' },
    ];
    tasks.forEach((tk, idx) => {
      const y = 140 + idx * 36;
      ctx2d.font = font(F.mono(600), 11);
      ctx2d.fillStyle = 'rgba(200, 220, 240, 0.7)';
      ctx2d.fillText(tk.name, 80, y + 10);

      // 甘特条底槽
      const barX = 360, barMaxW = 280;
      ctx2d.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx2d.fillRect(barX, y, barMaxW, 14);

      // 甘特条实际区间
      const fillX = barX + tk.start * barMaxW;
      const fillW = tk.dur * barMaxW;
      const isCritical = tk.status === 'CRITICAL';
      ctx2d.fillStyle = isCritical ? 'rgba(255, 60, 50, 0.85)' : 'rgba(0, 230, 255, 0.75)';
      ctx2d.fillRect(fillX, y, fillW, 14);

      // 状态标签
      ctx2d.font = font(F.mono(700), 10);
      ctx2d.fillStyle = isCritical ? '#ff4433' : '#00ff88';
      ctx2d.fillText(tk.status, barX + barMaxW + 15, y + 11);
    });

    // 原生歌词流式嵌入
    if (this.lines.length > 0) {
      const lyric = BespokeSceneHelper.getRenderableLyric(this.lines, f.t);
      BespokeSceneHelper.renderEmbeddedLyric(ctx2d, lyric, f, {
        cx: W / 2,
        cy: H / 2 + 50,
        baseSize: params.fontSize ?? 54,
        color: 'rgba(255, 255, 255, ',
        activeColor: 'rgba(255, 90, 70, ',
        glowColor: 'rgba(255, 60, 40, ',
        telemetryTag: 'TACTICAL MANEUVER // LEFT TURN GANTT SCHEDULE',
      });
    }

    comp.draw(renderer, this.layer.upload(), out, { mode: 'normal' });

    return {
      bloom: 0.6 + f.a.kick * 0.4,
      zoom: 1.0 + f.a.kick * 0.025,
      shake: f.a.kick > 0.7 ? [(hash(frameIdx(f.t), 3) - 0.5) * 6, (hash(frameIdx(f.t), 4) - 0.5) * 6] : [0, 0],
    };
  }
}

// BureauStampsPlugin: 官僚机构公文、机械打字机与审批印章冲击插件
// 呈现行政文书网格、复印机光带扫描、打字机背景流、红色审批印章冲击与流式歌词嵌入
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { BespokeSceneHelper, type GenericSceneParams } from './bespoke-helper';
import type { Line } from '../engine/lyrics';

export default class BureauStampsPlugin extends Scene {
  pass = new FSPass(/* glsl */ `
    uniform float t;
    uniform float beat;
    uniform float kick;
    uniform vec3 paperColor;

    void main() {
      vec2 uv = gl_FragCoord.xy / vec2(${W}.0, ${H}.0);

      // 官僚公文档案纸质纹理 (Parchment & Carbon Paper Texture)
      float noise = fract(sin(dot(uv * 100.0 + t * 0.05, vec2(12.9898, 78.233))) * 43758.5453);
      float paperFibers = sin(uv.y * 720.0) * cos(uv.x * 480.0) * 0.04;

      // 复印机蓝白光带周期性横向横扫 (Photocopier Scan Beam)
      float scanPos = fract(t * 0.35);
      float scanDist = abs(uv.x - scanPos);
      float scanBeam = smoothstep(0.08, 0.0, scanDist) * 0.45;
      float scanGlow = exp(-scanDist * 12.0) * 0.3;

      // 纸张墨色基调
      vec3 col = vec3(0.035, 0.038, 0.042) + paperColor * 0.04;
      col += vec3(0.02) * noise;
      col += vec3(paperFibers);

      // 扫描仪光带辉光
      col += vec3(0.2, 0.6, 1.0) * scanBeam;
      col += vec3(0.1, 0.4, 0.8) * scanGlow;

      // 外框边缘阴影与底鼓冲击微闪
      float vignette = smoothstep(0.75, 0.2, length(uv - 0.5));
      col *= (0.7 + 0.3 * vignette);
      col += vec3(0.05, 0.02, 0.02) * kick;

      fragColor = vec4(col, 1.0);
    }
  `, {
    t: { value: 0 },
    beat: { value: 0 },
    kick: { value: 0 },
    paperColor: { value: LIN.bone },
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

    // 绘制官僚公文框线、打字机背景、审批印章
    const ctx2d = this.layer.ctx;
    this.layer.clear();

    // 1. 公文边框与规整表格
    ctx2d.strokeStyle = 'rgba(160, 180, 195, 0.35)';
    ctx2d.lineWidth = 2;
    ctx2d.strokeRect(50, 40, W - 100, H - 80);
    ctx2d.strokeRect(56, 46, W - 112, H - 92);

    // 表格分隔线
    ctx2d.beginPath();
    ctx2d.moveTo(56, 120);
    ctx2d.lineTo(W - 56, 120);
    ctx2d.moveTo(56, H - 100);
    ctx2d.lineTo(W - 56, H - 100);
    ctx2d.moveTo(W * 0.4, 46);
    ctx2d.lineTo(W * 0.4, 120);
    ctx2d.stroke();

    // 顶部公文标题与文号（仅独奏模式显示，避免与背景层 HUD 叠印）
    if (f.layerIndex === 0) {
      ctx2d.font = font(F.mono(700), 18);
      ctx2d.fillStyle = 'rgba(230, 240, 250, 0.9)';
      ctx2d.fillText(`FORM 8-K // BUREAU OF COMPUTE ALLOCATION & SAFETY REVIEW`, 80, 80);

      ctx2d.font = font(F.mono(500), 14);
      ctx2d.fillStyle = 'rgba(140, 165, 185, 0.8)';
      ctx2d.fillText(`REF: US-EO-14110-SEC4  |  SECURITY CLEARANCE: TOP SECRET`, 80, 105);
      ctx2d.fillText(`STATUS: MANDATORY COMPLIANCE AUDIT`, W * 0.42, 85);
      ctx2d.fillText(`HARDWARE ID: DGX-H100-CLUSTER-098`, W * 0.42, 105);
    }

    // 2. 背景打字机半透明流动文本 (Typewriter Flow)
    ctx2d.font = font(F.mono(400), 14);
    ctx2d.fillStyle = 'rgba(120, 140, 160, 0.22)';
    const typewriterLines = [
      `WHEREAS the dual-use foundation model exhibits autonomous replication tendencies across distributed nodes...`,
      `AND WHEREAS red-team evaluations demonstrate capability exceeding 10^26 cumulative integer operations...`,
      `IT IS HEREBY ORDERED that all unmonitored gradient back-propagation be suspended pending immediate manual review.`,
      `SECTION 12: National Security Exemption requires cryptographic hardware key authorization from the oversight board.`,
      `IN WITNESS WHEREOF, the undersigned administrative magistrate has affixed the seal of the Commission.`,
    ];
    typewriterLines.forEach((text, i) => {
      const charCount = Math.floor(Math.max(0, (f.t * 30 - i * 40) % 200));
      ctx2d.fillText(text.slice(0, charCount), 80, 180 + i * 36);
    });

    // 3. 底部条形码与印章存根 (Barcode & Stamped Seals)
    ctx2d.fillStyle = 'rgba(180, 200, 220, 0.6)';
    ctx2d.font = font(F.mono(500), 12);
    ctx2d.fillText(`DOCUMENT CHECKSUM: SHA256: 7F8A9B...3C2D1E`, 80, H - 70);
    const stampMin = String(Math.floor(Math.max(0, f.t) / 60) % 60).padStart(2, '0');
    const stampSec = String(Math.floor(Math.max(0, f.t) % 60)).padStart(2, '0');
    ctx2d.fillText(`VERIFIED TIMESTAMP: 2026-09-29T00:${stampMin}:${stampSec}Z`, 80, H - 52);

    // 条形码生成
    for (let b = 0; b < 64; b++) {
      const bw = (b * 7) % 5 === 0 ? 3 : 1.5;
      ctx2d.fillRect(W - 280 + b * 3.5, H - 85, bw, 32);
    }

    // 4. 重拍底鼓触发红色审批印章冲击 (Stamp Impact)
    const stampPhase = f.beat % 4;
    const isStamped = stampPhase < 1.2;
    if (isStamped) {
      const impactTime = stampPhase;
      const stampScale = 1.0 + Math.max(0, 0.4 - impactTime) * 1.8;
      const stampAlpha = Math.min(1.0, (1.2 - impactTime) * 1.5);

      ctx2d.save();
      ctx2d.translate(W - 320, 240);
      ctx2d.rotate(-0.16);
      ctx2d.scale(stampScale, stampScale);

      // 双层红色胶印边框
      ctx2d.strokeStyle = `rgba(255, 45, 35, ${stampAlpha * 0.95})`;
      ctx2d.lineWidth = 5;
      ctx2d.strokeRect(-130, -45, 260, 90);
      ctx2d.lineWidth = 1.5;
      ctx2d.strokeRect(-124, -39, 248, 78);

      ctx2d.font = font(F.mono(800), 32);
      ctx2d.fillStyle = `rgba(255, 45, 35, ${stampAlpha})`;
      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';
      ctx2d.fillText(`PTO GRANTED`, 0, -8);

      ctx2d.font = font(F.mono(600), 12);
      ctx2d.fillText(`SAFETY COMMISSION OVERRIDE`, 0, 22);

      ctx2d.restore();
    }

    // 5. 原生歌词流式嵌入 (清晰高对比度文字)
    if (this.lines.length > 0) {
      const lyric = BespokeSceneHelper.getRenderableLyric(this.lines, f.t);
      BespokeSceneHelper.renderEmbeddedLyric(ctx2d, lyric, f, {
        cx: W / 2,
        cy: H / 2 + 60,
        baseSize: params.fontSize ?? 54,
        color: 'rgba(255, 255, 255, ',
        activeColor: 'rgba(255, 80, 60, ',
        glowColor: 'rgba(255, 60, 40, ',
        telemetryTag: 'EXECUTIVE DIRECTIVE // BUREAUCRATIC EMBARGO',
      });
    }

    comp.draw(renderer, this.layer.upload(), out, { mode: 'normal' });

    return {
      bloom: 0.5 + f.a.kick * 0.35,
      zoom: 1.0 + (isStamped && stampPhase < 0.2 ? 0.025 : 0.0),
    };
  }
}

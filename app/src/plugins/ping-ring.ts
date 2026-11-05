// @pdoom-generated role=accent zh=冷色细环
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides, type SceneCtx } from '../engine/scene';
import { FSPass, clearRT } from '../engine/gl';

export default class PingRing extends Scene {
  private pass: FSPass;
  constructor(ctx: SceneCtx) {
    super(ctx);
    this.pass = new FSPass(`
      uniform float uTime;
      uniform float uDownbeat;
      uniform float uKick;
      void main() {
        vec2 p = vUv - 0.5;
        p.x *= 1.7778;
        float r = length(p);
        float radius = 0.28 + uDownbeat * 0.045;
        float w = 0.0035 + uDownbeat * 0.004;
        float ring = smoothstep(w, 0.0, abs(r - radius));
        float ang = atan(p.y, p.x);
        float shimmer = 0.75 + 0.25 * sin(ang * 6.0 + uTime * 2.0);
        vec3 col = vec3(0.35, 0.75, 1.0) * ring * shimmer * (0.35 + uDownbeat * 0.6);
        col += vec3(0.15, 0.45, 0.9) * pow(ring, 3.0) * 0.5;
        col = min(col, vec3(1.2));
        float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
        float a = smoothstep(0.025, 0.20, L);
        fragColor = vec4(col, a);
      }
    `, { uTime: { value: 0 }, uDownbeat: { value: 0 }, uKick: { value: 0 } });
  }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    clearRT(this.ctx.renderer, out, [0, 0, 0], 0);
    this.pass.u.uTime!.value = f.t;
    this.pass.u.uDownbeat!.value = f.downbeat;
    this.pass.u.uKick!.value = f.a.kick;
    this.pass.render(this.ctx.renderer, out);
  }
}

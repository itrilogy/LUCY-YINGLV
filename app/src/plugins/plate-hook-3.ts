import Hook from '../scenes/hook';
import type { SceneCtx } from '../engine/scene';

/** Original film plate mounted as a selectable shot. */
export default class PlateHook3 extends Hook {
  constructor(ctx: SceneCtx) {
    super(ctx);
    this.ctx.params = { ...{ n: 3 }, ...this.ctx.params };
  }
}

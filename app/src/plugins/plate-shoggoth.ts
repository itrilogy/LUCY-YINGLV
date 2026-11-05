import Shoggoth from '../scenes/shoggoth';
import type { SceneCtx } from '../engine/scene';

/** Original film plate mounted as a selectable shot. */
export default class PlateShoggoth extends Shoggoth {
  constructor(ctx: SceneCtx) {
    super(ctx);
  }
}

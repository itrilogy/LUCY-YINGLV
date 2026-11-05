import Fuse from '../scenes/fuse';
import type { SceneCtx } from '../engine/scene';

/** Original film plate mounted as a selectable shot. */
export default class PlateFuse extends Fuse {
  constructor(ctx: SceneCtx) {
    super(ctx);
  }
}

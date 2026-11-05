import Loom from '../scenes/loom';
import type { SceneCtx } from '../engine/scene';

/** Original film plate mounted as a selectable shot. */
export default class PlateLoom extends Loom {
  constructor(ctx: SceneCtx) {
    super(ctx);
  }
}

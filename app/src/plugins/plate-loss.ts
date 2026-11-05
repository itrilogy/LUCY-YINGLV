import LossScene from '../scenes/loss';
import type { SceneCtx } from '../engine/scene';

/** Original film plate mounted as a selectable shot. */
export default class PlateLoss extends LossScene {
  constructor(ctx: SceneCtx) {
    super(ctx);
  }
}

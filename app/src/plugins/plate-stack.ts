import Stack from '../scenes/stack';
import type { SceneCtx } from '../engine/scene';

/** Original film plate mounted as a selectable shot. */
export default class PlateStack extends Stack {
  constructor(ctx: SceneCtx) {
    super(ctx);
  }
}

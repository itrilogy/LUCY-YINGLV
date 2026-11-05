import OpenScene from '../scenes/open';
import type { SceneCtx } from '../engine/scene';

/** Original film plate mounted as a selectable shot. */
export default class PlateOpen extends OpenScene {
  constructor(ctx: SceneCtx) {
    super(ctx);
  }
}

import IlyaScene from '../scenes/ilya';
import type { SceneCtx } from '../engine/scene';

/** Original film plate mounted as a selectable shot. */
export default class PlateIlya extends IlyaScene {
  constructor(ctx: SceneCtx) {
    super(ctx);
  }
}

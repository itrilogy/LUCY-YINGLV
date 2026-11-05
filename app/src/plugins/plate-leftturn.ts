import LeftTurn from '../scenes/leftturn';
import type { SceneCtx } from '../engine/scene';

/** Original film plate mounted as a selectable shot. */
export default class PlateLeftturn extends LeftTurn {
  constructor(ctx: SceneCtx) {
    super(ctx);
  }
}

import Ascent from '../scenes/ascent';
import type { SceneCtx } from '../engine/scene';

/** Original film plate mounted as a selectable shot. */
export default class PlateAscent extends Ascent {
  constructor(ctx: SceneCtx) {
    super(ctx);
  }
}

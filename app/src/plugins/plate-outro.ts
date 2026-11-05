import Outro from '../scenes/outro';
import type { SceneCtx } from '../engine/scene';

/** Original film plate mounted as a selectable shot. */
export default class PlateOutro extends Outro {
  constructor(ctx: SceneCtx) {
    super(ctx);
  }
}

import Dense from '../scenes/dense';
import type { SceneCtx } from '../engine/scene';

/** Original film plate mounted as a selectable shot. */
export default class PlateDense extends Dense {
  constructor(ctx: SceneCtx) {
    super(ctx);
  }
}

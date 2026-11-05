import Bureau from '../scenes/bureau';
import type { SceneCtx } from '../engine/scene';

/** Original film plate mounted as a selectable shot. */
export default class PlateBureau extends Bureau {
  constructor(ctx: SceneCtx) {
    super(ctx);
  }
}

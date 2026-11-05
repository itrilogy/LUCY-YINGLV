import Paperclips from '../scenes/paperclips';
import type { SceneCtx } from '../engine/scene';

/** Original film plate mounted as a selectable shot. */
export default class PlatePaperclips extends Paperclips {
  constructor(ctx: SceneCtx) {
    super(ctx);
  }
}

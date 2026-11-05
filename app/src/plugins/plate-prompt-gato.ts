import Prompt from '../scenes/prompt';
import type { SceneCtx } from '../engine/scene';

/** Original film plate mounted as a selectable shot. */
export default class PlatePromptGato extends Prompt {
  constructor(ctx: SceneCtx) {
    super(ctx);
    this.ctx.params = { ...{ variant: 'gato' }, ...this.ctx.params };
  }
}

import SpacetimeScene from '../scenes/spacetime';
import type { SceneCtx } from '../engine/scene';

/** Original film plate mounted as a selectable shot. */
export default class PlateSpacetime extends SpacetimeScene {
  constructor(ctx: SceneCtx) {
    super(ctx);
  }
}

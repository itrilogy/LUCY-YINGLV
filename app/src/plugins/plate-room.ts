import Room from '../scenes/room';
import type { SceneCtx } from '../engine/scene';

/** Original film plate mounted as a selectable shot. */
export default class PlateRoom extends Room {
  constructor(ctx: SceneCtx) {
    super(ctx);
  }
}

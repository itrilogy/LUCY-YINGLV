import { describe, it, expect, vi } from 'vitest';
import { DisposableCollector } from '../disposable';

describe('engine/disposable DisposableCollector', () => {
  it('should track and dispose items in reverse order', () => {
    const collector = new DisposableCollector();
    const order: number[] = [];

    const item1 = { dispose: vi.fn(() => order.push(1)) };
    const item2 = { dispose: vi.fn(() => order.push(2)) };

    collector.track(item1);
    collector.track(item2);

    expect(collector.count).toBe(2);

    collector.disposeAll();

    expect(item1.dispose).toHaveBeenCalledTimes(1);
    expect(item2.dispose).toHaveBeenCalledTimes(1);
    expect(order).toEqual([2, 1]); // 后注册的先释放
    expect(collector.count).toBe(0);
  });

  it('should swallow and log errors during disposal without stopping other items', () => {
    const collector = new DisposableCollector();
    const broken = { dispose: vi.fn(() => { throw new Error('Disposal crash'); }) };
    const healthy = { dispose: vi.fn() };

    collector.add(broken, healthy);
    expect(collector.count).toBe(2);

    expect(() => collector.disposeAll()).not.toThrow();
    expect(broken.dispose).toHaveBeenCalledTimes(1);
    expect(healthy.dispose).toHaveBeenCalledTimes(1);
    expect(collector.count).toBe(0);
  });
});

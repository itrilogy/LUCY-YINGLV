// 统一资源生命周期释放管理 (Unified Resource Lifecycle & Disposal System)
// 依据 CODEBASE_ENGINEERING_AUDIT_AND_OPTIMIZATION_SPEC 规范设计

export interface Disposable {
  dispose(): void;
}

export class DisposableCollector implements Disposable {
  private items: Disposable[] = [];

  /**
   * 追踪一个可释放资源，并在本收集器 dispose 时自动释放。
   * 支持返回原对象以便链式或内联赋值。
   */
  track<T extends Disposable>(item: T): T {
    if (item && typeof item.dispose === 'function') {
      this.items.push(item);
    }
    return item;
  }

  /**
   * 批量添加资源
   */
  add(...items: (Disposable | null | undefined)[]): void {
    for (const it of items) {
      if (it && typeof it.dispose === 'function') {
        this.items.push(it);
      }
    }
  }

  /**
   * 释放所有已追踪资源并清空列表
   */
  dispose(): void {
    this.disposeAll();
  }

  disposeAll(): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (item && typeof item.dispose === 'function') {
        try {
          item.dispose();
        } catch (e) {
          console.warn('[DisposableCollector] Error disposing item:', e);
        }
      }
    }
    this.items.length = 0;
  }

  get count(): number {
    return this.items.length;
  }

  owns(item: Disposable): boolean {
    return this.items.includes(item);
  }
}

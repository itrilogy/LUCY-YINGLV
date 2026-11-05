// 结构化引擎错误采集体系 (Engine Structured Error System)
// 依据 CODEBASE_ENGINEERING_AUDIT_AND_OPTIMIZATION_SPEC 规范设计

export type ErrorSeverity = 'error' | 'warning' | 'info';
export type ErrorSource = 'engine' | 'scene' | 'plugin' | 'timeline' | 'audio' | 'lyrics' | 'workbench';

export interface EngineError {
  id: string;
  source: ErrorSource;
  severity: ErrorSeverity;
  context: string;
  message: string;
  stack?: string;
  timestamp: number;
}

export class ErrorCollector {
  private static instance: ErrorCollector | null = null;
  readonly errors: EngineError[] = [];
  private listeners: ((e: EngineError) => void)[] = [];

  static getInstance(): ErrorCollector {
    if (!ErrorCollector.instance) {
      ErrorCollector.instance = new ErrorCollector();
    }
    return ErrorCollector.instance;
  }

  report(error: Omit<EngineError, 'id' | 'timestamp'>): EngineError {
    const fullError: EngineError = {
      ...error,
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };

    this.errors.push(fullError);
    if (this.errors.length > 200) {
      this.errors.shift(); // 环形缓冲区上限 200 条
    }

    if (error.severity === 'error') {
      console.error(`[${error.source.toUpperCase()}][${error.context}] ${error.message}`, error.stack ?? '');
    } else if (error.severity === 'warning') {
      console.warn(`[${error.source.toUpperCase()}][${error.context}] ${error.message}`);
    } else {
      console.info(`[${error.source.toUpperCase()}][${error.context}] ${error.message}`);
    }

    for (const listener of this.listeners) {
      try {
        listener(fullError);
      } catch (err) {
        console.error('Error listener threw an exception:', err);
      }
    }

    return fullError;
  }

  onError(fn: (e: EngineError) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  clear(): void {
    this.errors.length = 0;
  }
}

export const errorCollector = ErrorCollector.getInstance();

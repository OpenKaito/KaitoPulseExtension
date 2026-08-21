import { createLogger } from './logger';

const logger = createLogger('error-handler');

export enum ErrorCategory {
  NETWORK = 'NETWORK',
  CACHE = 'CACHE',
  VALIDATION = 'VALIDATION',
  DOM = 'DOM',
  RUNTIME = 'RUNTIME',
  UNKNOWN = 'UNKNOWN',
}

export class AppError extends Error {
  constructor(
    message: string,
    public category: ErrorCategory,
    public context?: Record<string, any>,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AppError';

    const captureStackTrace = (Error as unknown as {
      captureStackTrace?: (target: object, ctor?: new (...args: any[]) => any) => void;
    }).captureStackTrace;
    if (captureStackTrace) {
      captureStackTrace(this, AppError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      context: this.context,
      stack: this.stack,
      originalError: this.originalError?.message,
    };
  }
}

export enum ErrorStrategy {
  LOG_AND_CONTINUE = 'LOG_AND_CONTINUE',
  LOG_AND_THROW = 'LOG_AND_THROW',
  LOG_AND_RETURN_DEFAULT = 'LOG_AND_RETURN_DEFAULT',
  SILENT = 'SILENT',
}

interface ErrorHandlerConfig {
  strategy: ErrorStrategy;
  defaultValue?: any;
  context?: Record<string, any>;
}

export class ErrorHandler {

  static handle(
    error: unknown,
    category: ErrorCategory,
    config: ErrorHandlerConfig
  ): any {
    const appError = this.normalize(error, category, config.context);

    switch (config.strategy) {
      case ErrorStrategy.LOG_AND_CONTINUE:
        this.logError(appError);
        return;

      case ErrorStrategy.LOG_AND_THROW:
        this.logError(appError);
        throw appError;

      case ErrorStrategy.LOG_AND_RETURN_DEFAULT:
        this.logError(appError);
        return config.defaultValue;

      case ErrorStrategy.SILENT:

        return config.defaultValue;

      default:
        this.logError(appError);
        throw appError;
    }
  }

  private static normalize(
    error: unknown,
    category: ErrorCategory,
    context?: Record<string, any>
  ): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError(error.message, category, context, error);
    }

    const message = typeof error === 'string'
      ? error
      : JSON.stringify(error) || 'Unknown error';

    return new AppError(message, category, context);
  }

  private static logError(error: AppError): void {
    const logData = error.toJSON();

    switch (error.category) {
      case ErrorCategory.NETWORK:
      case ErrorCategory.CACHE:

        logger.warn(error.message, logData);
        break;

      case ErrorCategory.VALIDATION:

        logger.warn(error.message, logData);
        break;

      case ErrorCategory.DOM:
      case ErrorCategory.RUNTIME:
      case ErrorCategory.UNKNOWN:
      default:

        logger.error(error.message, logData);
        break;
    }
  }

  static async wrapAsync<T>(
    fn: () => Promise<T>,
    category: ErrorCategory,
    config: ErrorHandlerConfig
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      return this.handle(error, category, config);
    }
  }

  static wrapSync<T>(
    fn: () => T,
    category: ErrorCategory,
    config: ErrorHandlerConfig
  ): T {
    try {
      return fn();
    } catch (error) {
      return this.handle(error, category, config);
    }
  }
}

export function handleNetworkError<T = any[]>(
  error: unknown,
  defaultValue: T = [] as any,
  context?: Record<string, any>
): T {
  return ErrorHandler.handle(error, ErrorCategory.NETWORK, {
    strategy: ErrorStrategy.LOG_AND_RETURN_DEFAULT,
    defaultValue,
    context,
  });
}

export function handleCacheError(
  error: unknown,
  context?: Record<string, any>
): void {
  ErrorHandler.handle(error, ErrorCategory.CACHE, {
    strategy: ErrorStrategy.LOG_AND_CONTINUE,
    context,
  });
}

export function handleValidationError<T = null>(
  error: unknown,
  defaultValue: T = null as any,
  context?: Record<string, any>
): T {
  return ErrorHandler.handle(error, ErrorCategory.VALIDATION, {
    strategy: ErrorStrategy.LOG_AND_RETURN_DEFAULT,
    defaultValue,
    context,
  });
}

export function handleDOMError(
  error: unknown,
  context?: Record<string, any>
): void {
  ErrorHandler.handle(error, ErrorCategory.DOM, {
    strategy: ErrorStrategy.LOG_AND_CONTINUE,
    context,
  });
}

export function handleCriticalError(
  error: unknown,
  context?: Record<string, any>
): never {
  ErrorHandler.handle(error, ErrorCategory.RUNTIME, {
    strategy: ErrorStrategy.LOG_AND_THROW,
    context,
  });

  throw new Error('Unreachable');
}

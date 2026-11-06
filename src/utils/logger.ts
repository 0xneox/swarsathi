/**
 * Minimal logger.
 *
 * SwarSathi never logs message contents: a spoken message is by definition private. Only the shape
 * of an operation (codes, ids, counts) may be logged, and only in development builds.
 */

const isDevelopment = __DEV__ === true;

function log(level: 'debug' | 'info' | 'warn' | 'error', scope: string, message: string, meta?: unknown) {
  if (!isDevelopment) {
    return;
  }
  const prefix = `[SwarSathi:${scope}] ${message}`;
  if (meta === undefined) {
    console[level](prefix);
  } else {
    console[level](prefix, meta);
  }
}

export const logger = {
  debug: (scope: string, message: string, meta?: unknown) => log('debug', scope, message, meta),
  info: (scope: string, message: string, meta?: unknown) => log('info', scope, message, meta),
  warn: (scope: string, message: string, meta?: unknown) => log('warn', scope, message, meta),
  error: (scope: string, message: string, meta?: unknown) => log('error', scope, message, meta),
};

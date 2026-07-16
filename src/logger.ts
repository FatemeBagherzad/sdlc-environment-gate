type Level = 'debug' | 'info' | 'warn' | 'error';

function print(level: Level, message: string, details?: Record<string, unknown>): void {
  const line = {
    time: new Date().toISOString(),
    pid: process.pid,
    level: level,
    message: message,
    ...details
  };

  console.log(JSON.stringify(line));
}

export const logger = {
  debug(message: string, details?: Record<string, unknown>): void {
    print('debug', message, details);
  },
  info(message: string, details?: Record<string, unknown>): void {
    print('info', message, details);
  },
  warn(message: string, details?: Record<string, unknown>): void {
    print('warn', message, details);
  },
  error(message: string, details?: Record<string, unknown>): void {
    print('error', message, details);
  }
};

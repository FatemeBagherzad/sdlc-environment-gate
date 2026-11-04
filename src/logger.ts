type Level = 'debug' | 'info' | 'warn' | 'error';

const levelNumbers: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function configuredLevel(): number {
  const name = (process.env.LOG_LEVEL || 'info').toLowerCase() as Level;

  return levelNumbers[name] || levelNumbers.info;
}

function print(level: Level, message: string, details?: Record<string, unknown>): void {
  if (levelNumbers[level] < configuredLevel()) {
    return;
  }

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

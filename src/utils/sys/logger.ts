/**
 * 开发态日志工具。生产构建不会输出 log/info/debug，
 * 与 vite terser pure_funcs 形成双重保障。
 */
const isDev = import.meta.env.DEV

type LogArgs = unknown[]

function noop(..._args: LogArgs) {
  // production: silent
}

export const logger = {
  log: isDev ? (...args: LogArgs) => console.log(...args) : noop,
  info: isDev ? (...args: LogArgs) => console.info(...args) : noop,
  debug: isDev ? (...args: LogArgs) => console.debug(...args) : noop,
  warn: (...args: LogArgs) => console.warn(...args),
  error: (...args: LogArgs) => console.error(...args)
}

export default logger

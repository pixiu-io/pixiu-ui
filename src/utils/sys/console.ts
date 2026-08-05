import { logger } from './logger'

// ANSI 转义码生成网站  https://patorjk.com/software/taag/#p=display&f=Big&t=ABB%0A
const asciiArt = `
\x1b[32m欢迎使用 Pixiu Cloud！https://github.com/caoyingjunz/pixiu
\x1b[0m
`

logger.log(asciiArt)

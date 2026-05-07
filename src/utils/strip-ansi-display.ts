/**
 * 去掉 ANSI/OSC 等转义序列，供「纯文本伪终端」展示（不解析颜色与光标）。
 * 参考 strip-ansi / ansi-regex 的常见 CSI 形态。
 */
export function stripAnsiSequences(input: string): string {
  let s = input
  // CSI: ESC [ ... 以 0x40–0x7E 结尾（含 [m [K [?1034h 等）
  // eslint-disable-next-line no-control-regex
  s = s.replace(/\x1b\[[\x30-\x3f]*[\x20-\x2f]*[\x40-\x7e]/gi, '')
  // OSC: ESC ] ... BEL
  // eslint-disable-next-line no-control-regex
  s = s.replace(/\x1b\][^\x07]*\x07/g, '')
  // OSC: ESC ] ... ST (ESC \)
  // eslint-disable-next-line no-control-regex
  s = s.replace(/\x1b\][^\x1b\\]*\x1b\\/g, '')
  // 两字节 ESC 序列（如 ESC N）
  // eslint-disable-next-line no-control-regex
  s = s.replace(/\x1b[\x20-\x2f][\x30-\x7e]/g, '')
  // 单字节 ESC 后缀（如 ESC M）
  // eslint-disable-next-line no-control-regex
  s = s.replace(/\x1b[\x30-\x5f]/g, '')
  // 兼容 UTF-8 下的 CSI 引导符 0x9B (C1)
  // eslint-disable-next-line no-control-regex
  s = s.replace(/\u009b[\x30-\x3f]*[\x20-\x2f]*[\x40-\x7e]/gi, '')
  // 孤立 ESC，避免页面上残留「半个」序列
  // eslint-disable-next-line no-control-regex
  s = s.replace(/\x1b/g, '')
  s = s.replace(/\u009b/g, '')
  return s
}

/** 统一换行，避免 \r 与伪终端分行逻辑叠加产生乱行 */
export function normalizeNewlinesForPlainTerminal(input: string): string {
  return input.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

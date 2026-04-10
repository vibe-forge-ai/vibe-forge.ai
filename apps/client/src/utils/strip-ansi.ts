const ESCAPE = 27

export const stripAnsi = (value: string) => {
  let output = ''
  let index = 0

  while (index < value.length) {
    if (value.charCodeAt(index) === ESCAPE && value[index + 1] === '[') {
      index += 2
      while (index < value.length) {
        const code = value.charCodeAt(index)
        if (code >= 64 && code <= 126) {
          index += 1
          break
        }
        index += 1
      }
      continue
    }

    output += value[index]
    index += 1
  }

  return output
}

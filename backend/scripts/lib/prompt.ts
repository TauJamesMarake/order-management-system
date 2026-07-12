import * as readline from 'readline'

export function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

/*
 * Ctrl+C during input exits the process cleanly.
 */
export function askSecret(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    return ask(question)
  }

  return new Promise((resolve, reject) => {
    process.stdout.write(question)
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    let value = ''

    const onData = (char: string) => {
      switch (char) {
        case '\r':
        case '\n':
          process.stdin.setRawMode(false)
          process.stdin.pause()
          process.stdin.removeListener('data', onData)
          process.stdout.write('\n')
          resolve(value)
          break

        case '\u0003':
          // Ctrl+C — exit without printing a stack trace
          process.stdout.write('\nAborted.\n')
          process.exit(1)
          break

        case '\u007f':
          // Backspace
          value = value.slice(0, -1)
          break

        default:
          value += char
      }
    }

    process.stdin.on('data', onData)
  })
}
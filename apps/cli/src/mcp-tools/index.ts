import wait from './general/wait'
import askUser from './interaction/ask-user'
import task from './task'
import type { Register } from './types'

export const tools: Record<string, Register> = {
  general: (server) => {
    wait(server)
  },
  interaction: (server) => {
    askUser(server)
  },
  task: (server) => {
    task(server)
  }
}

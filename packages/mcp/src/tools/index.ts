import wait from './general/wait'
import askUser from './interaction/ask-user'
import { createTaskRegister } from './task'
import type { Register } from './types'

export const createMcpTools = (): Record<string, Register> => ({
  general: (server) => {
    wait(server)
  },
  interaction: (server) => {
    askUser(server)
  },
  task: createTaskRegister()
})

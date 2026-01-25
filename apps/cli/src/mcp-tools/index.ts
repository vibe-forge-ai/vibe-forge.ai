import wait from './general/wait'
import type { Register } from './types'

export const tools: Record<string, Register> = {
  general: (server) => {
    wait(server)
  }
}

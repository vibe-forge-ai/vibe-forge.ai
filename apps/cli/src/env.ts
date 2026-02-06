import process from 'node:process'

import { resolve } from 'node:path'

import dotenv from 'dotenv'

dotenv.config({
  quiet: true,
  path: resolve(process.env.__VF_PROJECT_WORKSPACE_FOLDER__ ?? process.cwd(), './.env')
})
dotenv.config({
  quiet: true,
  path: resolve(process.env.__VF_PROJECT_WORKSPACE_FOLDER__ ?? process.cwd(), './.env.dev')
})

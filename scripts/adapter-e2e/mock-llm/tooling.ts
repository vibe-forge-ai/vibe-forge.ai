import path from 'node:path'

import { repoRoot } from '../runtime'
import type {
  JsonObject,
  JsonValue,
  MockToolCall,
  MockToolCandidate
} from '../types'
import { asArray, asObject } from './request'

const getToolName = (tool: JsonObject) => {
  if (typeof tool.name === 'string' && tool.name.trim() !== '') return tool.name
  const func = asObject(tool.function)
  if (typeof func.name === 'string' && func.name.trim() !== '') return func.name
  if (typeof tool.type === 'string' && tool.type.trim() !== '' && tool.type !== 'function') {
    return tool.type
  }
  return undefined
}

const getToolParameters = (tool: JsonObject): JsonObject => {
  const func = asObject(tool.function)
  return asObject(tool.parameters ?? func.parameters ?? tool.input_schema ?? tool.inputSchema)
}

const resolveToolArgs = (
  toolName: string,
  toolParameters: JsonObject
): Record<string, JsonValue> => {
  const normalized = toolName.toLowerCase()
  const properties = asObject(toolParameters.properties)
  const readmePath = path.resolve(repoRoot, 'README.md')

  if (
    normalized === 'read'
    || 'filePath' in properties
    || 'file_path' in properties
    || 'path' in properties
  ) {
    return {
      ...('file_path' in properties ? { file_path: readmePath } : {}),
      ...('filePath' in properties || !('file_path' in properties) ? { filePath: readmePath } : {}),
      ...('path' in properties ? { path: readmePath } : {}),
      offset: 1,
      limit: 2000
    }
  }

  if (normalized === 'exec_command' || 'cmd' in properties) {
    return {
      cmd: "sed -n '1,200p' README.md",
      workdir: repoRoot,
      yield_time_ms: 1000,
      max_output_tokens: 2000
    }
  }

  if (
    normalized === 'bash'
    || normalized === 'shell'
    || normalized === 'local_shell'
    || 'command' in properties
  ) {
    return {
      command: "sed -n '1,200p' README.md"
    }
  }

  return {}
}

export const getToolCandidates = (body: JsonObject): MockToolCandidate[] => (
  asArray(body.tools)
    .map((value) => asObject(value))
    .map((tool) => {
      const name = getToolName(tool)
      const parameters = getToolParameters(tool)
      return {
        name: name ?? '',
        parameters,
        args: name == null ? {} : resolveToolArgs(name, parameters)
      }
    })
    .filter(candidate => candidate.name !== '')
)

export const pickToolCall = (body: JsonObject): MockToolCall | undefined => {
  const candidates = getToolCandidates(body)
  const preferred = candidates.find(item => item.name.toLowerCase() === 'read')
    ?? candidates.find(item => item.name.toLowerCase() === 'exec_command')
    ?? candidates.find(item => item.name.toLowerCase() === 'bash')
    ?? candidates.find(item => item.name.toLowerCase() === 'shell')
    ?? candidates.find(item => Object.keys(item.args).length > 0)

  return preferred == null
    ? undefined
    : {
        name: preferred.name,
        args: preferred.args
      }
}

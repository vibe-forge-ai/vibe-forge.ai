import { existsSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { parseQueryWorkerToolResult, resolveMdpServerCliPath } from '../src/query-worker'

describe('resolveMdpServerCliPath', () => {
  it('resolves the mdp server cli without relying on package.json subpath exports', () => {
    const cliPath = resolveMdpServerCliPath(process.cwd())

    expect(cliPath.endsWith('/dist/cli.js')).toBe(true)
    expect(existsSync(cliPath)).toBe(true)
  })
})

describe('parseQueryWorkerToolResult', () => {
  it('prefers structured content when present', () => {
    expect(parseQueryWorkerToolResult({
      structuredContent: { ok: true }
    })).toEqual({ ok: true })
  })

  it('parses JSON text payloads', () => {
    expect(parseQueryWorkerToolResult({
      content: [
        {
          type: 'text',
          text: '{"ok":true,"data":{"value":1}}'
        }
      ]
    })).toEqual({
      ok: true,
      data: {
        value: 1
      }
    })
  })

  it('preserves plain-text upstream errors instead of rethrowing a JSON parse error', () => {
    expect(() => parseQueryWorkerToolResult({
      content: [
        {
          type: 'text',
          text: 'Client "70bbdaa9d296" is not valid JSON'
        }
      ]
    })).toThrow('Client "70bbdaa9d296" is not valid JSON')
  })
})

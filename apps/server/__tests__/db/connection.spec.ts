import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createConnection } from '../../src/db/connection'

describe('createConnection', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.DB_PATH
  })

  it('uses ~/.vf/db.sqlite when DB_PATH is not configured', () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-home-'))
    vi.spyOn(os, 'homedir').mockReturnValue(tempHome)

    const connection = createConnection()

    try {
      expect(connection.dbPath).toBe(path.join(tempHome, '.vf', 'db.sqlite'))
      expect(fs.existsSync(path.join(tempHome, '.vf'))).toBe(true)
      expect(fs.existsSync(connection.dbPath)).toBe(true)
    } finally {
      connection.db.close()
      fs.rmSync(tempHome, { force: true, recursive: true })
    }
  })

  it('creates missing parent directories for a custom file path', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-db-path-'))
    const dbPath = path.join(tempDir, 'nested', 'custom.sqlite')
    process.env.DB_PATH = dbPath

    const connection = createConnection()

    try {
      expect(connection.dbPath).toBe(dbPath)
      expect(fs.existsSync(path.dirname(dbPath))).toBe(true)
      expect(fs.existsSync(dbPath)).toBe(true)
    } finally {
      connection.db.close()
      fs.rmSync(tempDir, { force: true, recursive: true })
    }
  })

  it('appends db.sqlite when DB_PATH points to a directory', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-db-dir-'))
    process.env.DB_PATH = tempDir

    const connection = createConnection()

    try {
      expect(connection.dbPath).toBe(path.join(tempDir, 'db.sqlite'))
      expect(fs.existsSync(connection.dbPath)).toBe(true)
    } finally {
      connection.db.close()
      fs.rmSync(tempDir, { force: true, recursive: true })
    }
  })
})

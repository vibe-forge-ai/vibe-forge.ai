import { access, copyFile, lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const stripWrappingQuotes = (value: string) => value.replace(/^["']|["']$/g, '')

export const normalizeNonEmptyString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
)

export const parseSkillFrontmatterValue = (body: string, key: 'description' | 'name') => {
  const lines = body.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return undefined

  for (const line of lines.slice(1)) {
    if (line.trim() === '---') break
    const separatorIndex = line.indexOf(':')
    if (separatorIndex <= 0) continue
    if (line.slice(0, separatorIndex).trim() !== key) continue
    const value = stripWrappingQuotes(line.slice(separatorIndex + 1).trim())
    return value === '' ? undefined : value
  }

  return undefined
}

export const pathExists = async (targetPath: string) => {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

export const copyRegularFiles = async (sourceDir: string, targetDir: string) => {
  let fileCount = 0
  const entries = await readdir(sourceDir, { withFileTypes: true })

  await mkdir(targetDir, { recursive: true })

  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry.name)
    const targetPath = join(targetDir, entry.name)
    const stat = await lstat(sourcePath)

    if (stat.isDirectory()) {
      fileCount += await copyRegularFiles(sourcePath, targetPath)
      continue
    }

    if (!stat.isFile()) continue

    await mkdir(dirname(targetPath), { recursive: true })
    await copyFile(sourcePath, targetPath)
    fileCount += 1
  }

  return fileCount
}

export const rewriteInstalledSkillName = async (skillPath: string, targetName: string) => {
  const content = await readFile(skillPath, 'utf8')
  const normalizedName = /^[\w./-]+$/.test(targetName)
    ? targetName
    : JSON.stringify(targetName)
  const lines = content.split(/\r?\n/)

  if (lines[0]?.trim() !== '---') {
    const nextContent = `---\nname: ${normalizedName}\n---\n\n${content.replace(/^\s+/, '')}`
    await writeFile(skillPath, nextContent, 'utf8')
    return
  }

  let closingIndex = -1
  let nameIndex = -1
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() === '---') {
      closingIndex = index
      break
    }
    if (/^\s*name\s*:/.test(lines[index] ?? '')) {
      nameIndex = index
    }
  }

  if (closingIndex < 0) {
    const nextContent = `---\nname: ${normalizedName}\n---\n\n${content.replace(/^\s+/, '')}`
    await writeFile(skillPath, nextContent, 'utf8')
    return
  }

  if (nameIndex >= 0) {
    lines[nameIndex] = `name: ${normalizedName}`
  } else {
    lines.splice(closingIndex, 0, `name: ${normalizedName}`)
  }

  await writeFile(skillPath, `${lines.join('\n').replace(/\s+$/, '')}\n`, 'utf8')
}

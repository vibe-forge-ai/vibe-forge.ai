#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import process from 'node:process'

const CONVENTIONAL_TYPES = [
  'build',
  'chore',
  'ci',
  'docs',
  'feat',
  'fix',
  'perf',
  'refactor',
  'revert',
  'style',
  'test'
]

const CONVENTIONAL_COMMIT_RE = new RegExp(
  `^(?:${CONVENTIONAL_TYPES.join('|')})(?:\\([\\w./-]+\\))?!?: .+`
)
const MERGE_COMMIT_RE =
  /^Merge (?:pull request #\d+ from .+|branch '.+'(?: into .+)?|remote-tracking branch '.+'(?: into .+)?)$/
const REVERT_COMMIT_RE = /^Revert ".+"$/
const EMPTY_TREE_SHA = /^0+$/

function runGit(args) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

function isZeroSha(value) {
  return value.length > 0 && EMPTY_TREE_SHA.test(value)
}

function getRevisionRange(base, head) {
  if (base.length === 0 || isZeroSha(base)) {
    return head
  }

  return `${base}..${head}`
}

const [base = '', head = 'HEAD'] = process.argv.slice(2)
const revisionRange = getRevisionRange(base, head)
const commits = runGit(['rev-list', '--reverse', revisionRange])
  .split('\n')
  .filter(Boolean)

if (commits.length === 0) {
  process.stdout.write(`[commitmsg] no commits found for ${revisionRange}\n`)
  process.exit(0)
}

const invalidCommits = []

for (const commit of commits) {
  const subject = runGit(['show', '--quiet', '--format=%s', commit])

  if (
    CONVENTIONAL_COMMIT_RE.test(subject) ||
    MERGE_COMMIT_RE.test(subject) ||
    REVERT_COMMIT_RE.test(subject)
  ) {
    continue
  }

  invalidCommits.push({
    commit,
    subject
  })
}

if (invalidCommits.length > 0) {
  process.stderr.write('[commitmsg] invalid commit subjects:\n')

  for (const { commit, subject } of invalidCommits) {
    process.stderr.write(`- ${commit.slice(0, 7)} ${subject}\n`)
  }

  process.stderr.write(
    '\nExpected a Conventional Commit subject such as "feat(cli): add resume command".\n' +
      'Merge commits created by GitHub are allowed.\n'
  )
  process.exit(1)
}

process.stdout.write(`[commitmsg] validated ${commits.length} commit(s) in ${revisionRange}\n`)

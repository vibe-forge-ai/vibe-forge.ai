import process from 'node:process'

import type { BenchmarkCase, BenchmarkCategory, BenchmarkResult } from '@vibe-forge/core'
import {
  getBenchmarkCase,
  listBenchmarkCases,
  listBenchmarkCategories,
  readBenchmarkResult,
  runBenchmarkCase,
  runBenchmarkCategory
} from '@vibe-forge/core/controllers/benchmark'
import type { Command } from 'commander'

interface BenchmarkRunOptions {
  category: string
  title?: string
  concurrency?: string
  adapter?: string
  model?: string
  systemPrompt?: string
  permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
}

const printResult = (result: BenchmarkResult) => {
  console.table([{
    Category: result.category,
    Title: result.title,
    Status: result.status,
    Score: result.finalScore,
    Test: result.scores.testScore,
    Goal: result.scores.goalScore,
    Reference: result.scores.referenceScore,
    DurationMs: result.durationMs,
    Timestamp: result.timestamp
  }])

  if (result.issues.length > 0) {
    console.log('\nIssues:')
    for (const issue of result.issues) {
      console.log(`- ${issue}`)
    }
  }
}

const createEventPrinter = () => {
  return (event: {
    category: string
    title?: string
    phase: string
    message: string
  }) => {
    const target = event.title ? `${event.category}/${event.title}` : event.category
    console.log(`[benchmark:${target}] [${event.phase}] ${event.message}`)
  }
}

export function registerBenchmarkCommand(program: Command) {
  const benchmark = program
    .command('benchmark')
    .description('List and run benchmark cases')

  benchmark
    .command('list')
    .description('List benchmark categories and cases')
    .option('--category <category>', 'Filter by category')
    .action(async (opts: { category?: string }) => {
      const categories = await listBenchmarkCategories()
      const cases = await listBenchmarkCases({
        category: opts.category
      })

      if (categories.length === 0) {
        console.log('No benchmark cases found.')
        return
      }

      console.log('Categories:')
      console.table(categories.map((item: BenchmarkCategory) => ({
        Category: item.category,
        Cases: item.caseCount,
        Pass: item.lastStatuses.pass,
        Partial: item.lastStatuses.partial,
        Fail: item.lastStatuses.fail
      })))

      if (cases.length === 0) {
        console.log(`No cases found for category ${opts.category}.`)
        return
      }

      console.log('\nCases:')
      console.table(cases.map((item: BenchmarkCase) => ({
        Category: item.category,
        Title: item.title,
        Summary: item.summary,
        Status: item.latestResult?.status ?? '-',
        Score: item.latestResult?.finalScore ?? '-'
      })))
    })

  benchmark
    .command('run')
    .description('Run one benchmark case or an entire category')
    .requiredOption('--category <category>', 'Benchmark category')
    .option('--title <title>', 'Benchmark title')
    .option('--concurrency <count>', 'Category concurrency', '2')
    .option('--adapter <adapter>', 'Adapter to use')
    .option('--model <model>', 'Model to use')
    .option('--system-prompt <prompt>', 'Additional system prompt')
    .option('--permission-mode <mode>', 'Permission mode')
    .action(async (opts: BenchmarkRunOptions) => {
      const onEvent = createEventPrinter()
      if (opts.title != null && opts.title !== '') {
        const output = await runBenchmarkCase({
          category: opts.category,
          title: opts.title,
          adapter: opts.adapter,
          model: opts.model,
          systemPrompt: opts.systemPrompt,
          permissionMode: opts.permissionMode,
          runtime: 'cli',
          onEvent
        })
        printResult(output.result)
        process.exit(output.result.status === 'fail' ? 1 : 0)
      }

      const concurrency = Number.parseInt(opts.concurrency ?? '2', 10)
      const output = await runBenchmarkCategory({
        category: opts.category,
        concurrency: Number.isNaN(concurrency) ? 2 : concurrency,
        adapter: opts.adapter,
        model: opts.model,
        systemPrompt: opts.systemPrompt,
        permissionMode: opts.permissionMode,
        runtime: 'cli',
        onEvent
      })

      console.table(output.results.map((result: BenchmarkResult) => ({
        Title: result.title,
        Status: result.status,
        Score: result.finalScore,
        Test: result.scores.testScore,
        Goal: result.scores.goalScore,
        Reference: result.scores.referenceScore
      })))

      const hasFailure = output.results.some((result: BenchmarkResult) => result.status === 'fail')
      process.exit(hasFailure ? 1 : 0)
    })

  benchmark
    .command('show')
    .description('Show benchmark case metadata and latest result')
    .requiredOption('--category <category>', 'Benchmark category')
    .requiredOption('--title <title>', 'Benchmark title')
    .action(async (opts: { category: string; title: string }) => {
      const caseItem = await getBenchmarkCase(opts)
      if (caseItem == null) {
        console.error(`Benchmark case not found: ${opts.category}/${opts.title}`)
        process.exit(1)
      }

      console.log('Case:')
      console.table([{
        Category: caseItem.category,
        Title: caseItem.title,
        Summary: caseItem.summary,
        BaseCommit: caseItem.frontmatter.baseCommit,
        Setup: caseItem.frontmatter.setupCommand,
        Test: caseItem.frontmatter.testCommand,
        TimeoutSec: caseItem.frontmatter.timeoutSec
      }])

      console.log('\nRFC:')
      console.log(caseItem.rfcBody)

      const result = await readBenchmarkResult(process.cwd(), opts.category, opts.title)
      if (result == null) {
        console.log('\nNo result.json found.')
        return
      }

      console.log('\nLatest Result:')
      printResult(result)
    })
}

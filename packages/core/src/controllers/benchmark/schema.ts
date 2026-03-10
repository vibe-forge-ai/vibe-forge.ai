import z from 'zod'

export const BenchmarkFrontmatterSchema = z.object({
  title: z.string().trim().optional(),
  description: z.string().trim().optional(),
  baseCommit: z.string().trim().min(1),
  setupCommand: z.string().trim().min(1),
  testCommand: z.string().trim().min(1),
  timeoutSec: z.number().int().positive().default(900)
})

export const BenchmarkStatusSchema = z.enum(['pass', 'partial', 'fail'])

export const BenchmarkScoresSchema = z.object({
  testScore: z.number().min(0).max(1),
  goalScore: z.number().min(0).max(1),
  referenceScore: z.number().min(0).max(1)
})

export const BenchmarkResultSchema = z.object({
  category: z.string().trim().min(1),
  title: z.string().trim().min(1),
  status: BenchmarkStatusSchema,
  finalScore: z.number().min(0).max(1),
  scores: BenchmarkScoresSchema,
  baseCommit: z.string().trim().min(1),
  durationMs: z.number().int().nonnegative(),
  setupCommand: z.string().trim().min(1),
  testCommand: z.string().trim().min(1),
  testExitCode: z.number().int(),
  judgeSummary: z.string(),
  issues: z.array(z.string()),
  timestamp: z.string().trim().min(1),
  runId: z.string().trim().min(1).optional(),
  taskSessionId: z.string().trim().min(1).optional(),
  taskExitCode: z.number().int().optional(),
  changedFiles: z.array(z.string()).optional(),
  categoryRunId: z.string().trim().min(1).optional()
})

export const BenchmarkRunSummarySchema = z.object({
  runId: z.string().trim().min(1),
  category: z.string().trim().min(1),
  title: z.string().trim().min(1).optional(),
  status: z.enum(['queued', 'running', 'completed', 'failed']),
  startedAt: z.number().int().positive(),
  finishedAt: z.number().int().positive().optional(),
  completedCount: z.number().int().nonnegative().optional(),
  totalCount: z.number().int().positive().optional(),
  result: BenchmarkResultSchema.optional(),
  results: z.array(BenchmarkResultSchema).optional(),
  error: z.string().optional(),
  lastMessage: z.string().optional()
})

export type BenchmarkFrontmatter = z.infer<typeof BenchmarkFrontmatterSchema>
export type BenchmarkStatus = z.infer<typeof BenchmarkStatusSchema>
export type BenchmarkScores = z.infer<typeof BenchmarkScoresSchema>
export type BenchmarkResult = z.infer<typeof BenchmarkResultSchema>
export type BenchmarkRunSummary = z.infer<typeof BenchmarkRunSummarySchema>

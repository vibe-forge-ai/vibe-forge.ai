import './BenchmarkCasePanel.scss'

import { Button, Divider, Empty, Progress, Tag, Typography } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { MarkdownContent } from '#~/components/MarkdownContent'
import type { BenchmarkCase, BenchmarkResult, BenchmarkRunSummary } from '@vibe-forge/core'

import { formatTimestamp, getResultStatusMeta } from './utils.js'

function ResultStatusTag({ result }: { result: BenchmarkResult | null | undefined }) {
  const { t } = useTranslation()
  const meta = getResultStatusMeta(result)
  const colorMap: Record<string, string> = {
    'no-result': 'default',
    pass: 'success',
    partial: 'warning',
    fail: 'error'
  }
  return (
    <Tag color={colorMap[meta.statusKey]} className='benchmark-view__status-tag'>
      <span className='material-symbols-rounded benchmark-view__tag-icon'>{meta.icon}</span>
      {meta.statusKey === 'no-result' ? t('benchmark.noResult') : t(`benchmark.status.${meta.statusKey}`)}
    </Tag>
  )
}

function SectionLabel({ icon, title, extra }: { icon: string; title: string; extra?: React.ReactNode }) {
  return (
    <div className='benchmark-view__section-label'>
      <div className='benchmark-view__section-title'>
        <span className='material-symbols-rounded benchmark-view__section-icon'>{icon}</span>
        <span>{title}</span>
      </div>
      {extra != null ? <div className='benchmark-view__section-extra'>{extra}</div> : null}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BenchmarkCasePanelProps {
  selectedCase: BenchmarkCase | null
  latestResult: BenchmarkResult | null
  activeRun: BenchmarkRunSummary | null | undefined
  activeRunId: string
  progressPercent: number
  onRunCase: () => void
}

export function BenchmarkCasePanel({
  selectedCase,
  latestResult,
  activeRun,
  activeRunId,
  progressPercent,
  onRunCase
}: BenchmarkCasePanelProps) {
  const { t } = useTranslation()

  if (selectedCase == null) {
    return (
      <div className='benchmark-view__empty'>
        <Empty description={t('benchmark.emptyCases')} />
      </div>
    )
  }

  const displayTitle = selectedCase.frontmatter.title ?? selectedCase.title
  const displayDescription = selectedCase.frontmatter.description ?? selectedCase.summary ?? ''

  return (
    <div className='benchmark-view__canvas'>
      <div className='benchmark-view__case-header'>
        <div className='benchmark-view__case-title-row'>
          <Typography.Title level={3} className='benchmark-view__case-title'>
            {displayTitle}
          </Typography.Title>
          <Button
            type='primary'
            icon={<span className='material-symbols-rounded'>play_circle</span>}
            onClick={onRunCase}
          />
        </div>
        {displayDescription
          ? (
            <Typography.Paragraph type='secondary' className='benchmark-view__case-desc'>
              {displayDescription}
            </Typography.Paragraph>
          )
          : null}
        <div className='benchmark-view__case-meta'>
          <span className='benchmark-view__meta-item'>
            <span className='material-symbols-rounded'>history</span>
            {t('benchmark.lastRunAt')}
            {': '}
            {formatTimestamp(latestResult?.timestamp)}
          </span>
        </div>
      </div>

      <Divider className='benchmark-view__sep' />

      {/* Config + Goal */}
      <div className='benchmark-view__twin-grid'>
        <div className='benchmark-view__section'>
          <SectionLabel icon='tune' title={t('benchmark.configTitle')} />
          <div className='benchmark-view__info-grid'>
            <div className='benchmark-view__info-row'>
              <label>
                <span className='material-symbols-rounded'>commit</span>
                {t('benchmark.baseCommit')}
              </label>
              <code>{selectedCase.frontmatter.baseCommit}</code>
            </div>
            <div className='benchmark-view__info-row'>
              <label>
                <span className='material-symbols-rounded'>timer</span>
                {t('benchmark.timeoutSec')}
              </label>
              <span>{selectedCase.frontmatter.timeoutSec}</span>
            </div>
            <div className='benchmark-view__info-row benchmark-view__info-row--block'>
              <label>
                <span className='material-symbols-rounded'>build</span>
                {t('benchmark.setupCommand')}
              </label>
              <MarkdownContent content={`\`\`\`bash\n${selectedCase.frontmatter.setupCommand}\n\`\`\``} />
            </div>
            <div className='benchmark-view__info-row benchmark-view__info-row--block'>
              <label>
                <span className='material-symbols-rounded'>science</span>
                {t('benchmark.testCommand')}
              </label>
              <MarkdownContent content={`\`\`\`bash\n${selectedCase.frontmatter.testCommand}\n\`\`\``} />
            </div>
          </div>
        </div>

        <div className='benchmark-view__section benchmark-view__task-goal'>
          <SectionLabel icon='assignment' title={t('benchmark.taskGoal')} />
          <div className='benchmark-view__goal-body'>
            <MarkdownContent content={selectedCase.rfcBody} />
          </div>
        </div>
      </div>

      <Divider className='benchmark-view__sep' />

      {/* Run state + Result */}
      <div className='benchmark-view__twin-grid benchmark-view__section--last'>
        <RunStateSection
          activeRunId={activeRunId}
          activeRun={activeRun}
          progressPercent={progressPercent}
          t={t}
        />
        <ResultSection latestResult={latestResult} t={t} />
      </div>
    </div>
  )
}

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function RunStateSection({
  activeRunId,
  activeRun,
  progressPercent,
  t
}: {
  activeRunId: string
  activeRun: BenchmarkRunSummary | null | undefined
  progressPercent: number
  t: ReturnType<typeof useTranslation>['t']
}) {
  return (
    <div className='benchmark-view__section'>
      <SectionLabel
        icon='pulse_alert'
        title={t('benchmark.runState')}
        extra={activeRun ? <Tag>{activeRun.status}</Tag> : null}
      />
      {activeRunId === ''
        ? (
          <Typography.Text type='secondary' className='benchmark-view__hint'>
            {t('benchmark.noActiveRun')}
          </Typography.Text>
        )
        : (
          <div className='benchmark-view__run-block'>
            <div className='benchmark-view__run-metric'>
              <label>{t('benchmark.progress')}</label>
              <strong>{`${activeRun?.completedCount ?? 0}/${activeRun?.totalCount ?? '-'}`}</strong>
            </div>
            <Progress percent={progressPercent} showInfo={false} />
            <div className='benchmark-view__info-grid'>
              <div className='benchmark-view__info-row'>
                <label>{t('benchmark.runStatus')}</label>
                <span>{activeRun?.status ?? '-'}</span>
              </div>
              <div className='benchmark-view__info-row'>
                <label>{t('benchmark.lastMessage')}</label>
                <Typography.Text>{activeRun?.lastMessage ?? '-'}</Typography.Text>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}

function ResultSection({
  latestResult,
  t
}: {
  latestResult: BenchmarkResult | null
  t: ReturnType<typeof useTranslation>['t']
}) {
  return (
    <div className='benchmark-view__section'>
      <SectionLabel
        icon='insights'
        title={t('benchmark.resultTitle')}
        extra={latestResult ? <ResultStatusTag result={latestResult} /> : null}
      />
      {latestResult == null
        ? (
          <Typography.Text type='secondary' className='benchmark-view__hint'>
            {t('benchmark.noResult')}
          </Typography.Text>
        )
        : (
          <div className='benchmark-view__result'>
            <div className='benchmark-view__score-strip'>
              <div className='benchmark-view__score-item'>
                <label>{t('benchmark.finalScore')}</label>
                <strong>{latestResult.finalScore}</strong>
              </div>
              <div className='benchmark-view__score-item'>
                <label>{t('benchmark.testScore')}</label>
                <strong>{latestResult.scores.testScore}</strong>
              </div>
              <div className='benchmark-view__score-item'>
                <label>{t('benchmark.goalScore')}</label>
                <strong>{latestResult.scores.goalScore}</strong>
              </div>
              <div className='benchmark-view__score-item'>
                <label>{t('benchmark.referenceScore')}</label>
                <strong>{latestResult.scores.referenceScore}</strong>
              </div>
            </div>
            <div className='benchmark-view__info-grid'>
              <div className='benchmark-view__info-row'>
                <label>
                  <span className='material-symbols-rounded'>schedule</span>
                  {t('benchmark.durationMs')}
                </label>
                <span>{latestResult.durationMs}</span>
              </div>
              <div className='benchmark-view__info-row'>
                <label>
                  <span className='material-symbols-rounded'>monitoring</span>
                  {t('benchmark.testExitCode')}
                </label>
                <span>{latestResult.testExitCode}</span>
              </div>
            </div>
            <Typography.Paragraph className='benchmark-view__judge-summary'>
              {latestResult.judgeSummary}
            </Typography.Paragraph>
            <div className='benchmark-view__subgrid'>
              <div className='benchmark-view__subpanel'>
                <div className='benchmark-view__subpanel-title'>
                  <span className='material-symbols-rounded'>plagiarism</span>
                  <span>{t('benchmark.changedFiles')}</span>
                </div>
                {latestResult.changedFiles != null && latestResult.changedFiles.length > 0
                  ? (
                    <div className='benchmark-view__file-list'>
                      {latestResult.changedFiles.map((file: string) => (
                        <span key={file} className='benchmark-view__file-tag'>{file}</span>
                      ))}
                    </div>
                  )
                  : (
                    <Typography.Text type='secondary'>{t('benchmark.noChangedFiles')}</Typography.Text>
                  )}
              </div>
              <div className='benchmark-view__subpanel'>
                <div className='benchmark-view__subpanel-title'>
                  <span className='material-symbols-rounded'>report</span>
                  <span>{t('benchmark.issues')}</span>
                </div>
                {latestResult.issues.length === 0
                  ? <Typography.Text type='secondary'>{t('benchmark.noIssues')}</Typography.Text>
                  : (
                    <ul className='benchmark-view__issues-list'>
                      {latestResult.issues.map((issue: string) => <li key={issue}>{issue}</li>)}
                    </ul>
                  )}
              </div>
            </div>
          </div>
        )}
    </div>
  )
}

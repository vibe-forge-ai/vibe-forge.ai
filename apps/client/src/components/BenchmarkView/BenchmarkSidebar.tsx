import './BenchmarkSidebar.scss'

import { Badge, Button, Divider, Empty, Input, Tooltip, Tree, Typography } from 'antd'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { BenchmarkCase, BenchmarkCategory } from '@vibe-forge/core'

import type { TreeNodeCase } from './types.js'
import { getResultStatusMeta } from './utils.js'

function ResultStatusIcon({ result }: { result: import('@vibe-forge/core').BenchmarkResult | null | undefined }) {
  const meta = getResultStatusMeta(result)
  return (
    <span className={`material-symbols-rounded benchmark-view__status-icon benchmark-view__status-icon--${meta.statusKey}`}>
      {meta.icon}
    </span>
  )
}

// ─── Tree builder ─────────────────────────────────────────────────────────────

function buildCaseTreeData(params: {
  categories: BenchmarkCategory[]
  cases: BenchmarkCase[]
  query: string
  t: ReturnType<typeof useTranslation>['t']
  onRunCase: (item: BenchmarkCase) => void
  onRunCategory: (category: string) => void
}) {
  const { categories, cases, query, t, onRunCase, onRunCategory } = params
  const keyword = query.trim().toLowerCase()

  const categoriesOrder = categories.length > 0
    ? categories
    : Array.from(new Set(cases.map(item => item.category))).map(category => ({
      category,
      caseCount: cases.filter(item => item.category === category).length,
      lastStatuses: { pass: 0, partial: 0, fail: 0 }
    }))

  return categoriesOrder
    .map((category) => {
      const categoryCases = cases.filter(item => item.category === category.category)
      const categoryMatches = keyword === '' || category.category.toLowerCase().includes(keyword)
      const matchedCases = categoryMatches
        ? categoryCases
        : categoryCases.filter((item) => {
          const rfcTitle = item.frontmatter.title ?? ''
          return (
            item.title.toLowerCase().includes(keyword) ||
            rfcTitle.toLowerCase().includes(keyword)
          )
        })

      if (matchedCases.length === 0) return null

      return {
        key: `category:${category.category}`,
        selectable: true,
        title: (
          <div className='benchmark-view__tree-category'>
            <span className='material-symbols-rounded benchmark-view__tree-icon benchmark-view__tree-icon--category'>folder_open</span>
            <Typography.Text strong className='benchmark-view__tree-title'>
              {category.category}
            </Typography.Text>
            <Tooltip title={t('benchmark.runCategory')}>
              <Button
                type='text'
                size='small'
                className='benchmark-view__tree-run-btn benchmark-view__tree-run-btn--category'
                icon={<span className='material-symbols-rounded'>play_circle</span>}
                onClick={(e) => {
                  e.stopPropagation()
                  onRunCategory(category.category)
                }}
              />
            </Tooltip>
          </div>
        ),
        children: matchedCases.map((item) => {
          const nodeCase: TreeNodeCase = { ...item, key: `case:${item.category}/${item.title}` }
          const displayTitle = item.frontmatter.title ?? item.title
          return {
            key: nodeCase.key,
            isLeaf: true,
            title: (
              <div className='benchmark-view__tree-case'>
                <ResultStatusIcon result={nodeCase.latestResult} />
                <span className='material-symbols-rounded benchmark-view__tree-icon'>draft</span>
                <Typography.Text className='benchmark-view__tree-title'>{displayTitle}</Typography.Text>
                <Tooltip title={t('benchmark.runCase')}>
                  <Button
                    type='text'
                    size='small'
                    className='benchmark-view__tree-run-btn'
                    icon={<span className='material-symbols-rounded'>play_circle</span>}
                    onClick={(e) => {
                      e.stopPropagation()
                      onRunCase(item)
                    }}
                  />
                </Tooltip>
              </div>
            ),
            caseData: nodeCase
          }
        })
      }
    })
    .filter(Boolean)
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BenchmarkSidebarProps {
  cases: BenchmarkCase[]
  categories: BenchmarkCategory[]
  selectedCase: BenchmarkCase | null
  query: string
  expandedKeys: string[]
  checkedKeys: string[]
  checkedCaseCount: number
  onQueryChange: (value: string) => void
  onExpandedKeysChange: (keys: string[]) => void
  onCheckedKeysChange: (keys: string[]) => void
  onSelectCase: (category: string, title: string) => void
  onRunCase: (item: BenchmarkCase) => void
  onRunCategory: (category: string) => void
  onBatchRun: () => void
}

export function BenchmarkSidebar({
  cases,
  categories,
  selectedCase,
  query,
  expandedKeys,
  checkedKeys,
  checkedCaseCount,
  onQueryChange,
  onExpandedKeysChange,
  onCheckedKeysChange,
  onSelectCase,
  onRunCase,
  onRunCategory,
  onBatchRun
}: BenchmarkSidebarProps) {
  const { t } = useTranslation()

  const treeData = useMemo(() =>
    buildCaseTreeData({
      categories,
      cases,
      query,
      t,
      onRunCase,
      onRunCategory
    }),
    [cases, categories, query, t]
  )

  const handleTreeCheck = (
    checked: React.Key[] | { checked: React.Key[]; halfChecked: React.Key[] }
  ) => {
    const keys = Array.isArray(checked) ? checked : checked.checked
    onCheckedKeysChange(keys.map(String))
  }

  const handleTreeSelect = (_keys: React.Key[], info: {
    node: {
      key: React.Key
      caseData?: TreeNodeCase
    }
  }) => {
    const caseData = info.node.caseData
    if (caseData != null) {
      onSelectCase(caseData.category, caseData.title)
      return
    }
    const categoryKey = String(info.node.key)
    if (!categoryKey.startsWith('category:')) return
    const category = categoryKey.replace('category:', '')
    const nextCase = cases.find(item => item.category === category)
    onSelectCase(category, nextCase?.title ?? '')
  }

  return (
    <div className='benchmark-view__sidebar'>
      <div className='benchmark-view__sidebar-header'>
        <Typography.Title level={4} className='benchmark-view__sidebar-title'>
          {t('benchmark.title')}
        </Typography.Title>
      </div>

      <div className='benchmark-view__search-row'>
        <Input
          value={query}
          placeholder={t('benchmark.searchPlaceholder')}
          prefix={<span className='material-symbols-rounded benchmark-view__search-icon'>search</span>}
          allowClear
          onChange={event => onQueryChange(event.target.value)}
          className='benchmark-view__search'
        />
        <Tooltip title={t('benchmark.expandAll')}>
          <Button
            type='text'
            size='small'
            icon={<span className='material-symbols-rounded'>unfold_more</span>}
            onClick={() => onExpandedKeysChange(categories.map(item => `category:${item.category}`))}
          />
        </Tooltip>
        <Tooltip title={t('benchmark.collapseAll')}>
          <Button
            type='text'
            size='small'
            icon={<span className='material-symbols-rounded'>unfold_less</span>}
            onClick={() => onExpandedKeysChange([])}
          />
        </Tooltip>
        <Tooltip
          title={checkedCaseCount > 0
            ? t('benchmark.runSelected', { count: checkedCaseCount })
            : t('benchmark.runAll')}
        >
          <Badge count={checkedCaseCount} size='small'>
            <Button
              type='text'
              size='small'
              icon={<span className='material-symbols-rounded'>play_circle</span>}
              onClick={onBatchRun}
            />
          </Badge>
        </Tooltip>
      </div>

      <div className='benchmark-view__tree-shell'>
        {treeData.length === 0
          ? (
              <div className='benchmark-view__tree-empty'>
                <Empty description={t('benchmark.emptyCases')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            )
          : (
              <Tree
                blockNode
                checkable
                showIcon={false}
                switcherIcon={<span className='material-symbols-rounded benchmark-view__switcher'>chevron_right</span>}
                selectedKeys={selectedCase ? [`case:${selectedCase.category}/${selectedCase.title}`] : []}
                expandedKeys={expandedKeys}
                checkedKeys={checkedKeys}
                treeData={treeData}
                onExpand={(keys) => onExpandedKeysChange(keys.map(String))}
                onSelect={handleTreeSelect}
                onCheck={handleTreeCheck}
              />
            )}
      </div>
    </div>
  )
}

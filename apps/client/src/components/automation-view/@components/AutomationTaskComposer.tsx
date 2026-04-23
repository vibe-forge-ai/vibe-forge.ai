/* eslint-disable max-lines -- task composer wires Sender, status bar, and collapse behavior together */
import { Button, Form, Input, Tooltip } from 'antd'
import type { FormInstance } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { ConfigResponse } from '@vibe-forge/types'

import { getConfig } from '#~/api.js'
import { Sender } from '#~/components/chat/sender/Sender'
import { ChatStatusBar } from '#~/components/chat/status-bar/ChatStatusBar'
import {
  DEFAULT_CHAT_SESSION_WORKSPACE_DRAFT,
  getChatSessionWorkspaceDraftFromConfig
} from '#~/hooks/chat/chat-session-workspace-draft'
import type { ChatSessionWorkspaceDraft } from '#~/hooks/chat/chat-session-workspace-draft'

import { useAutomationStartupOptionsData } from '../@hooks/use-automation-startup-options-data'
import { useAutomationStartupStaticOptions } from '../@hooks/use-automation-startup-static-options'
import { DEFAULT_STARTUP_FORM_VALUES, isNonEmptyString } from '../@utils/startup-options'
import type { RuleFormValues } from '../types'

interface AutomationTaskComposerProps {
  fieldName: number
  form: FormInstance<RuleFormValues>
}

interface AutomationTaskSenderProps extends AutomationTaskComposerProps {
  onChange?: (value: string) => void
  value?: string
}

const noop = () => {}
const preventSubmit = () => false

const isSenderEffort = (value: unknown): value is NonNullable<RuleFormValues['tasks'][number]['effort']> => (
  value === 'default' || value === 'low' || value === 'medium' || value === 'high' || value === 'max'
)

function AutomationTaskSender({ fieldName, form, onChange, value }: AutomationTaskSenderProps) {
  const { t } = useTranslation()
  const emittedValueRef = useRef(value ?? '')
  const [initialContent, setInitialContent] = useState(value ?? '')
  const adapter = Form.useWatch(['tasks', fieldName, 'adapter'], form)
  const model = Form.useWatch(['tasks', fieldName, 'model'], form)
  const effort = Form.useWatch(['tasks', fieldName, 'effort'], form)
  const selectedAdapter = isNonEmptyString(adapter) ? adapter : undefined
  const selectedModel = isNonEmptyString(model) ? model : undefined
  const selectedEffort = isSenderEffort(effort) ? effort : 'default'
  const {
    adapterOptions,
    effectiveAdapter,
    effectiveEffort,
    effectiveModel,
    modelMenuGroups,
    modelSearchOptions,
    recommendedModelOptions,
    servicePreviewModelOptions
  } = useAutomationStartupOptionsData({
    selectedAdapter,
    selectedEffort,
    selectedModel
  })
  const { effortOptions } = useAutomationStartupStaticOptions(t)

  useEffect(() => {
    const nextValue = value ?? ''

    if (nextValue === emittedValueRef.current) {
      return
    }

    emittedValueRef.current = nextValue
    setInitialContent(nextValue)
  }, [value])

  const setTaskField = (name: keyof RuleFormValues['tasks'][number], nextValue: unknown) => {
    form.setFieldValue(['tasks', fieldName, name], nextValue)
  }

  return (
    <div className='automation-view__task-sender'>
      <Sender
        initialContent={initialContent}
        placeholder={t('automation.prompt')}
        hideReferenceActions
        hideSubmitAction
        forceEffortControl
        adapterOptions={adapterOptions}
        selectedAdapter={effectiveAdapter}
        onAdapterChange={(nextAdapter) => setTaskField('adapter', nextAdapter)}
        modelMenuGroups={modelMenuGroups}
        modelSearchOptions={modelSearchOptions}
        recommendedModelOptions={recommendedModelOptions}
        servicePreviewModelOptions={servicePreviewModelOptions}
        selectedModel={effectiveModel}
        onModelChange={(nextModel) => setTaskField('model', nextModel)}
        effort={effectiveEffort}
        effortOptions={effortOptions}
        onEffortChange={(nextEffort) => setTaskField('effort', nextEffort)}
        onInputChange={(nextValue) => {
          emittedValueRef.current = nextValue
          onChange?.(nextValue)
        }}
        onInterrupt={noop}
        onSend={preventSubmit}
        onSendContent={preventSubmit}
      />
    </div>
  )
}

const getTaskWorkspaceDraft = (
  task: RuleFormValues['tasks'][number] | undefined,
  defaultDraft: ChatSessionWorkspaceDraft
): ChatSessionWorkspaceDraft => {
  const createWorktreeMode = task?.createWorktreeMode ?? DEFAULT_STARTUP_FORM_VALUES.createWorktreeMode
  const branchAction = task?.branchAction ?? DEFAULT_STARTUP_FORM_VALUES.branchAction
  const branchName = task?.branchName?.trim() ?? ''
  const createWorktree = createWorktreeMode === 'managed'
    ? true
    : createWorktreeMode === 'local'
    ? false
    : defaultDraft.createWorktree

  return {
    createWorktree,
    branch: branchAction === 'default' || branchName === ''
      ? undefined
      : {
        mode: branchAction,
        name: branchName,
        kind: task?.branchKind ?? DEFAULT_STARTUP_FORM_VALUES.branchKind
      }
  }
}

function AutomationTaskStatusBar({ fieldName, form }: AutomationTaskComposerProps) {
  const { data: configRes } = useSWR<ConfigResponse>('/api/config', getConfig)
  const task = Form.useWatch(['tasks', fieldName], form)
  const defaultDraft = useMemo(() => (
    configRes == null ? DEFAULT_CHAT_SESSION_WORKSPACE_DRAFT : getChatSessionWorkspaceDraftFromConfig(configRes)
  ), [configRes])
  const draftWorkspace = useMemo(() => getTaskWorkspaceDraft(task, defaultDraft), [defaultDraft, task])
  const handleDraftWorkspaceChange = useCallback((nextDraft: ChatSessionWorkspaceDraft) => {
    form.setFieldValue(
      ['tasks', fieldName, 'createWorktreeMode'],
      nextDraft.createWorktree ? 'managed' : 'local'
    )

    if (nextDraft.branch == null) {
      form.setFieldValue(['tasks', fieldName, 'branchAction'], 'default')
      form.setFieldValue(['tasks', fieldName, 'branchName'], '')
      form.setFieldValue(['tasks', fieldName, 'branchKind'], DEFAULT_STARTUP_FORM_VALUES.branchKind)
      return
    }

    form.setFieldValue(['tasks', fieldName, 'branchAction'], nextDraft.branch.mode)
    form.setFieldValue(['tasks', fieldName, 'branchName'], nextDraft.branch.name)
    form.setFieldValue(
      ['tasks', fieldName, 'branchKind'],
      nextDraft.branch.kind ?? DEFAULT_STARTUP_FORM_VALUES.branchKind
    )
  }, [fieldName, form])

  return (
    <div className='automation-view__task-status-bar'>
      <ChatStatusBar
        draftWorkspace={draftWorkspace}
        isCreating={false}
        onDraftWorkspaceChange={handleDraftWorkspaceChange}
      />
    </div>
  )
}

export function AutomationTaskComposer({ fieldName, form }: AutomationTaskComposerProps) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`automation-view__task-composer ${collapsed ? 'is-collapsed' : ''}`.trim()}>
      <div className='automation-view__task-title-row'>
        <Tooltip title={collapsed ? t('automation.expandTask') : t('automation.collapseTask')}>
          <Button
            aria-expanded={!collapsed}
            aria-label={collapsed ? t('automation.expandTask') : t('automation.collapseTask')}
            className='automation-view__task-collapse-button'
            type='text'
            onClick={() => setCollapsed(prev => !prev)}
          >
            <span className='material-symbols-rounded automation-view__action-icon'>
              {collapsed ? 'chevron_right' : 'keyboard_arrow_down'}
            </span>
          </Button>
        </Tooltip>
        <Form.Item className='automation-view__task-title-item' name={[fieldName, 'title']}>
          <Input
            aria-label={t('automation.taskTitle')}
            className='automation-view__task-title-input'
            placeholder={t('automation.taskTitlePlaceholder')}
          />
        </Form.Item>
      </div>
      <div className='automation-view__task-collapsible' hidden={collapsed}>
        <div className='sender-container automation-view__task-sender-stack'>
          <Form.Item
            className='automation-view__task-prompt-item'
            name={[fieldName, 'prompt']}
            rules={[{ required: true, message: t('automation.promptRequired') }]}
          >
            <AutomationTaskSender fieldName={fieldName} form={form} />
          </Form.Item>
          <AutomationTaskStatusBar fieldName={fieldName} form={form} />
        </div>
      </div>
    </div>
  )
}

import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { createInstance } from 'i18next'

const createI18n = async () => {
  const i18n = createInstance()
  await i18n
    .use(initReactI18next)
    .init({
      lng: 'zh',
      resources: {
        zh: {
          translation: {
            chat: {
              permissionRequestTitleWithTool: '正在请求使用【{{tool}}】的调用权限，请选择通过',
              permissionExpandOptions: '展开更多选项',
              permissionCollapseOptions: '收起更多选项'
            }
          }
        }
      }
    })

  return i18n
}

const renderPanel = async ({
  showAllOptions = false
}: {
  showAllOptions?: boolean
} = {}) => {
  vi.resetModules()

  if (showAllOptions) {
    vi.doMock('react', async () => {
      const actual = await vi.importActual<typeof import('react')>('react')
      return {
        ...actual,
        useEffect: () => undefined,
        useState: () => [true, vi.fn()]
      }
    })
  } else {
    vi.doUnmock('react')
  }

  const [{ SenderInteractionPanel }, i18n] = await Promise.all([
    import('#~/components/chat/sender/@components/sender-interaction-panel/SenderInteractionPanel'),
    createI18n()
  ])

  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <SenderInteractionPanel
        interactionRequest={{
          id: 'interaction-1',
          payload: {
            sessionId: 'sess-1',
            kind: 'permission',
            question: '当前任务需要使用 Write 才能继续，请选择处理方式。',
            options: [
              { label: '同意本次', value: 'allow_once', description: '仅继续这次被拦截的操作。' },
              { label: '同意并在当前会话忽略类似调用', value: 'allow_session', description: '本会话内同类工具不再重复询问。' },
              { label: '同意并在当前项目忽略类似调用', value: 'allow_project', description: '写入 .ai.config.json，后续新会话仍生效。' },
              { label: '拒绝本次', value: 'deny_once', description: '拒绝当前这次操作。' },
              { label: '拒绝并在当前会话阻止类似调用', value: 'deny_session', description: '本会话内同类工具直接拒绝。' },
              { label: '拒绝并在当前项目阻止类似调用', value: 'deny_project', description: '写入 .ai.config.json，后续新会话仍生效。' }
            ],
            permissionContext: {
              adapter: 'claude-code',
              subjectKey: 'Write',
              subjectLabel: 'Write',
              scope: 'tool',
              projectConfigPath: '.ai.config.json',
              currentMode: 'default'
            }
          }
        }}
        permissionContext={{
          adapter: 'claude-code',
          subjectKey: 'Write',
          subjectLabel: 'Write',
          scope: 'tool',
          projectConfigPath: '.ai.config.json',
          currentMode: 'default'
        }}
        deniedTools={['Write']}
        reasons={['Permission required to continue']}
      />
    </I18nextProvider>
  )
}

afterEach(() => {
  vi.doUnmock('react')
  vi.resetModules()
})

describe('sender interaction panel', () => {
  it('renders the primary permission actions by default', async () => {
    const html = await renderPanel()

    expect(html).toContain('正在请求使用【Write】的调用权限，请选择通过')
    expect(html).toContain('同意本次')
    expect(html).toContain('同意并在当前会话忽略类似调用')
    expect(html).toContain('拒绝本次')
    expect(html).toContain('展开更多选项')
    expect(html).not.toContain('同意并在当前项目忽略类似调用')
    expect(html).not.toContain('拒绝并在当前会话阻止类似调用')
    expect(html).not.toContain('拒绝并在当前项目阻止类似调用')
    expect(html.match(/interaction-panel__option-label/g)?.length).toBe(3)
  })

  it('renders secondary permission actions after expanding', async () => {
    const html = await renderPanel({ showAllOptions: true })

    expect(html).toContain('收起更多选项')
    expect(html).toContain('同意并在当前项目忽略类似调用')
    expect(html).toContain('拒绝并在当前会话阻止类似调用')
    expect(html).toContain('拒绝并在当前项目阻止类似调用')
    expect(html.match(/interaction-panel__option-label/g)?.length).toBe(6)
  })
})

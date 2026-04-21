import { Button, Empty, Form, Input, Modal, Spin } from 'antd'
import type { FormInstance } from 'antd'
import { useTranslation } from 'react-i18next'

import type { SkillHubItem } from '#~/api.js'
import { SkillMarketResults } from './SkillMarketResults'

export interface SkillsCliFormValues {
  source: string
  query?: string
  registry?: string
}

interface SkillsCliModalProps {
  canLoadMore: boolean
  form: FormInstance<SkillsCliFormValues>
  hasSearched: boolean
  installingId: string | null
  items: SkillHubItem[]
  loadingMore: boolean
  open: boolean
  resetKey: string
  searchError?: string | null
  searching: boolean
  onClose: () => void
  onInstall: (item: SkillHubItem) => void
  onLoadMore: () => void
  onSearch: () => void | Promise<void>
}

export function SkillsCliModal({
  canLoadMore,
  form,
  hasSearched,
  installingId,
  items,
  loadingMore,
  open,
  resetKey,
  searchError,
  searching,
  onClose,
  onInstall,
  onLoadMore,
  onSearch
}: SkillsCliModalProps) {
  const { t } = useTranslation()

  return (
    <Modal
      title={t('knowledge.skills.installViaSkillsCli')}
      open={open}
      footer={null}
      onCancel={onClose}
      destroyOnClose
      width={760}
    >
      <Form
        form={form}
        layout='vertical'
        initialValues={{ source: '', query: '', registry: '' }}
        className='knowledge-base-view__skills-cli-form'
      >
        <Form.Item
          name='source'
          label={t('knowledge.skills.skillsCliSource')}
          rules={[{ required: true, message: t('knowledge.skills.skillsCliSourceRequired') }]}
        >
          <Input
            placeholder={t('knowledge.skills.skillsCliSourcePlaceholder')}
            onPressEnter={(event) => {
              event.preventDefault()
              void onSearch()
            }}
          />
        </Form.Item>
        <Form.Item
          name='registry'
          label={t('knowledge.skills.skillsCliRegistry')}
        >
          <Input
            placeholder={t('knowledge.skills.skillsCliRegistryPlaceholder')}
            onPressEnter={(event) => {
              event.preventDefault()
              void onSearch()
            }}
          />
        </Form.Item>
        <div className='knowledge-base-view__skills-cli-search-row'>
          <Form.Item
            name='query'
            label={t('knowledge.skills.skillsCliQuery')}
            className='knowledge-base-view__skills-cli-search-field'
          >
            <Input
              allowClear
              placeholder={t('knowledge.skills.skillsCliQueryPlaceholder')}
              onPressEnter={(event) => {
                event.preventDefault()
                void onSearch()
              }}
            />
          </Form.Item>
          <Button
            type='primary'
            className='knowledge-base-view__skills-cli-search-button'
            loading={searching && !loadingMore}
            onClick={() => void onSearch()}
            icon={<span className='material-symbols-rounded'>search</span>}
          >
            {t('knowledge.skills.skillsCliSearch')}
          </Button>
        </div>
      </Form>

      {searching && items.length === 0 && (
        <div className='knowledge-base-view__loading'>
          <Spin />
        </div>
      )}
      {!searching && !hasSearched && (
        <div className='knowledge-base-view__skills-cli-placeholder'>
          {t('knowledge.skills.skillsCliHint')}
        </div>
      )}
      {!searching && searchError != null && searchError.trim() !== '' && (
        <div className='knowledge-base-view__skills-cli-error'>
          {searchError}
        </div>
      )}
      {!searching && hasSearched && searchError == null && items.length === 0 && (
        <div className='knowledge-base-view__empty-simple'>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('knowledge.skills.skillsCliEmpty')}
          />
        </div>
      )}
      {items.length > 0 && (
        <div className='knowledge-base-view__skills-cli-modal-results'>
          <SkillMarketResults
            canLoadMore={canLoadMore}
            hubItems={items}
            installingId={installingId}
            loadingMore={loadingMore}
            resetKey={resetKey}
            onInstall={onInstall}
            onLoadMore={onLoadMore}
          />
        </div>
      )}
    </Modal>
  )
}

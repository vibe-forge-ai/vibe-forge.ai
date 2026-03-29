export interface ServiceModelEntry {
  serviceKey: string
  model: string
  selectorValue: string
}

export type AdapterModelRuleRejectionReason = 'not_included' | 'excluded'

export interface AdapterModelFallbackWarning {
  type: 'adapter_model_fallback'
  adapter: string
  requestedModel: string
  resolvedModel: string
  reason: AdapterModelRuleRejectionReason
  includeModels?: string[]
  excludeModels?: string[]
}

export interface AdapterModelFallbackError {
  type: 'missing_default_model' | 'default_model_not_allowed'
  adapter: string
  requestedModel: string
  defaultModel?: string
  reason: AdapterModelRuleRejectionReason
  includeModels?: string[]
  excludeModels?: string[]
}

export interface AdapterModelCompatibilityResult {
  model?: string
  warning?: AdapterModelFallbackWarning
  error?: AdapterModelFallbackError
}

import { z } from 'zod'

export interface SchemaSummaryNode {
  type: string
  description?: string
  optional?: boolean
  nullable?: boolean
  literal?: string | number | boolean | null
  enumValues?: Array<string | number>
  properties?: Record<string, SchemaSummaryNode>
  item?: SchemaSummaryNode
  value?: SchemaSummaryNode
  variants?: SchemaSummaryNode[]
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value)
)

const unwrapSchema = (schema: z.ZodTypeAny) => {
  let current = schema
  let optional = false
  let nullable = false
  let description = schema.description

  while (true) {
    if (current instanceof z.ZodOptional) {
      optional = true
      description = description ?? current.unwrap().description
      current = current.unwrap()
      continue
    }

    if (current instanceof z.ZodNullable) {
      nullable = true
      description = description ?? current.unwrap().description
      current = current.unwrap()
      continue
    }

    if (current instanceof z.ZodDefault) {
      optional = true
      description = description ?? current.removeDefault().description
      current = current.removeDefault()
      continue
    }

    if (current instanceof z.ZodEffects) {
      description = description ?? current.innerType().description
      current = current.innerType()
      continue
    }

    break
  }

  return {
    schema: current,
    description,
    optional,
    nullable
  }
}

const toLiteralValue = (value: unknown): string | number | boolean | null | undefined => {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value == null
  ) {
    return value
  }

  return undefined
}

export const summarizeSchema = (schema: z.ZodTypeAny): SchemaSummaryNode => {
  const unwrapped = unwrapSchema(schema)
  const description = unwrapped.description ?? unwrapped.schema.description

  const withFlags = (node: SchemaSummaryNode): SchemaSummaryNode => ({
    ...node,
    ...(description ? { description } : {}),
    ...(unwrapped.optional ? { optional: true } : {}),
    ...(unwrapped.nullable ? { nullable: true } : {})
  })

  if (unwrapped.schema instanceof z.ZodObject) {
    const shape = unwrapped.schema.shape as Record<string, z.ZodTypeAny>
    return withFlags({
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(shape).map(([key, value]: [string, z.ZodTypeAny]) => [key, summarizeSchema(value)])
      )
    })
  }

  if (unwrapped.schema instanceof z.ZodArray) {
    return withFlags({
      type: 'array',
      item: summarizeSchema(unwrapped.schema.element)
    })
  }

  if (unwrapped.schema instanceof z.ZodRecord) {
    return withFlags({
      type: 'record',
      value: summarizeSchema(unwrapped.schema.valueSchema)
    })
  }

  if (unwrapped.schema instanceof z.ZodEnum) {
    return withFlags({
      type: 'enum',
      enumValues: [...unwrapped.schema.options]
    })
  }

  if (unwrapped.schema instanceof z.ZodNativeEnum) {
    return withFlags({
      type: 'enum',
      enumValues: Object.values(unwrapped.schema.enum)
        .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
    })
  }

  if (unwrapped.schema instanceof z.ZodUnion) {
    return withFlags({
      type: 'union',
      variants: unwrapped.schema.options.map((option: z.ZodTypeAny) => summarizeSchema(option))
    })
  }

  if (unwrapped.schema instanceof z.ZodLiteral) {
    return withFlags({
      type: 'literal',
      literal: toLiteralValue(unwrapped.schema.value)
    })
  }

  if (unwrapped.schema instanceof z.ZodString) {
    return withFlags({ type: 'string' })
  }

  if (unwrapped.schema instanceof z.ZodNumber) {
    return withFlags({ type: 'number' })
  }

  if (unwrapped.schema instanceof z.ZodBoolean) {
    return withFlags({ type: 'boolean' })
  }

  if (unwrapped.schema instanceof z.ZodNull) {
    return withFlags({ type: 'null' })
  }

  if (unwrapped.schema instanceof z.ZodUnknown) {
    return withFlags({ type: 'unknown' })
  }

  if (unwrapped.schema instanceof z.ZodAny) {
    return withFlags({ type: 'any' })
  }

  return withFlags({ type: 'unknown' })
}

const formatHeader = (summary: SchemaSummaryNode) => {
  const parts = [summary.type]
  if (summary.enumValues && summary.enumValues.length > 0) {
    parts.push(`one of: ${summary.enumValues.join(', ')}`)
  }
  if (summary.literal !== undefined) {
    parts.push(`literal: ${JSON.stringify(summary.literal)}`)
  }
  if (summary.optional) {
    parts.push('optional')
  }
  if (summary.nullable) {
    parts.push('nullable')
  }
  if (summary.description) {
    parts.push(summary.description)
  }
  return parts.join(' | ')
}

const renderSummaryLinesInternal = (
  summary: SchemaSummaryNode,
  indent = ''
): string[] => {
  const lines = [`${indent}- ${formatHeader(summary)}`]

  if (summary.properties && isPlainObject(summary.properties)) {
    for (const [key, value] of Object.entries(summary.properties)) {
      lines.push(`${indent}  - ${key}`)
      lines.push(...renderSummaryLinesInternal(value, `${indent}    `))
    }
  }

  if (summary.item != null) {
    lines.push(`${indent}  - items`)
    lines.push(...renderSummaryLinesInternal(summary.item, `${indent}    `))
  }

  if (summary.value != null) {
    lines.push(`${indent}  - values`)
    lines.push(...renderSummaryLinesInternal(summary.value, `${indent}    `))
  }

  if (summary.variants && summary.variants.length > 0) {
    summary.variants.forEach((variant, index) => {
      lines.push(`${indent}  - variant ${index + 1}`)
      lines.push(...renderSummaryLinesInternal(variant, `${indent}    `))
    })
  }

  return lines
}

export const renderSummaryLines = (
  title: string,
  schema: z.ZodTypeAny
) => [
  `## ${title}`,
  ...renderSummaryLinesInternal(summarizeSchema(schema))
]

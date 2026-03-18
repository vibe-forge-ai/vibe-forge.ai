export type SqlParam = string | number | null

export interface UpdateFieldDefinition<T extends Record<string, any>> {
  key: keyof T
  column?: string
  toParam?: (value: T[keyof T]) => SqlParam
}

export interface UpdateStatement {
  sql: string
  params: SqlParam[]
}

export function buildUpdateStatement<T extends Record<string, any>>(
  tableName: string,
  idColumn: string,
  idValue: SqlParam,
  updates: T,
  definitions: readonly UpdateFieldDefinition<T>[]
): UpdateStatement | undefined {
  const sets: string[] = []
  const params: SqlParam[] = []

  for (const definition of definitions) {
    const value = updates[definition.key]
    if (value === undefined) {
      continue
    }

    sets.push(`${definition.column ?? String(definition.key)} = ?`)
    params.push(definition.toParam ? definition.toParam(value) : (value as SqlParam))
  }

  if (sets.length === 0) {
    return undefined
  }

  params.push(idValue)

  return {
    sql: `UPDATE ${tableName} SET ${sets.join(', ')} WHERE ${idColumn} = ?`,
    params
  }
}

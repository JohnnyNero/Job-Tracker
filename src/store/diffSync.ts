import type { Dataset } from '../types'

export type TableName = Exclude<keyof Dataset, 'events'>

export type RowOp =
  | { op: 'insert'; table: TableName; row: Record<string, unknown> }
  | { op: 'update'; table: TableName; id: string; row: Record<string, unknown> }
  | { op: 'delete'; table: TableName; id: string }

const TABLES: TableName[] = [
  'capabilities',
  'role_profiles',
  'evidence',
  'cv_versions',
  'applications',
  'application_evidence',
  'criteria',
]

type Row = { id: string } & Record<string, unknown>

const byId = (rows: unknown[]): Map<string, Row> => {
  const m = new Map<string, Row>()
  for (const r of rows as Row[]) m.set(r.id, r)
  return m
}

/** Pure diff of two datasets into row operations. The `events` table is
 * deliberately excluded — Postgres triggers own it. */
export function computeDiff(prev: Dataset, next: Dataset): RowOp[] {
  const ops: RowOp[] = []
  for (const table of TABLES) {
    const before = byId(prev[table] as unknown[])
    const after = byId(next[table] as unknown[])
    for (const [id, row] of after) {
      const prior = before.get(id)
      if (!prior) ops.push({ op: 'insert', table, row })
      else if (JSON.stringify(prior) !== JSON.stringify(row))
        ops.push({ op: 'update', table, id, row })
    }
    for (const id of before.keys()) {
      if (!after.has(id)) ops.push({ op: 'delete', table, id })
    }
  }
  return ops
}

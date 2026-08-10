import type { Dataset } from '../types'

export type TableName = keyof Dataset

export type RowOp =
  | { op: 'insert'; table: TableName; row: Record<string, unknown> }
  | { op: 'update'; table: TableName; id: string; row: Record<string, unknown> }
  | { op: 'delete'; table: TableName; id: string }

// Tables synced with full insert/update/delete semantics.
const FULL_TABLES: TableName[] = [
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

const isStage = (row: Row): boolean => row.kind === 'stage'

/** Pure diff of two datasets into row operations.
 *
 * The `events` table is special: Postgres triggers own 'stage' events, so we
 * NEVER push them (that would double-log). User-authored events
 * (note/contact/told/draft) ARE synced, but only as insert/delete — events are
 * immutable once created, so no updates are emitted for them. */
export function computeDiff(prev: Dataset, next: Dataset): RowOp[] {
  const ops: RowOp[] = []

  for (const table of FULL_TABLES) {
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

  // events: sync only non-'stage' kinds, insert/delete only (immutable).
  const beforeEv = byId(prev.events as unknown[])
  const afterEv = byId(next.events as unknown[])
  for (const [id, row] of afterEv) {
    if (isStage(row)) continue
    if (!beforeEv.has(id)) ops.push({ op: 'insert', table: 'events', row })
  }
  for (const [id, row] of beforeEv) {
    if (isStage(row)) continue
    if (!afterEv.has(id)) ops.push({ op: 'delete', table: 'events', id })
  }

  return ops
}

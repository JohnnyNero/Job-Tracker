import type { Dataset } from '../types'

export type TableName = keyof Dataset

export type RowOp =
  | { op: 'insert'; table: TableName; row: Record<string, unknown> }
  | { op: 'update'; table: TableName; id: string; row: Record<string, unknown> }
  | { op: 'delete'; table: TableName; id?: string; match?: Record<string, unknown> }

// Tables synced by `id` with full insert/update/delete semantics.
const FULL_TABLES: TableName[] = [
  'capabilities',
  'role_profiles',
  'evidence',
  'cv_versions',
  'applications',
  'criteria',
]

type Row = Record<string, unknown>

const byKey = (rows: unknown[], key: (r: Row) => string): Map<string, Row> => {
  const m = new Map<string, Row>()
  for (const r of rows as Row[]) m.set(key(r), r)
  return m
}

const idKey = (r: Row): string => r.id as string
const isStage = (row: Row): boolean => row.kind === 'stage'
const aeKey = (r: Row): string => `${r.application_id as string}|${r.evidence_id as string}`

/** Pure diff of two datasets into row operations.
 *
 * Two tables are special:
 * - `events`: Postgres triggers own 'stage' events, so we NEVER push them
 *   (that would double-log). User-authored events (note/contact/told/draft)
 *   ARE synced, insert/delete only — events are immutable, no updates.
 * - `application_evidence`: a composite-PK join row (application_id,
 *   evidence_id) with no `id` column. Immutable, so insert/delete only, keyed
 *   on the pair; deletes carry a `match` object rather than an `id`. */
export function computeDiff(prev: Dataset, next: Dataset): RowOp[] {
  const ops: RowOp[] = []

  for (const table of FULL_TABLES) {
    const before = byKey(prev[table] as unknown[], idKey)
    const after = byKey(next[table] as unknown[], idKey)
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
  const beforeEv = byKey(prev.events as unknown[], idKey)
  const afterEv = byKey(next.events as unknown[], idKey)
  for (const [id, row] of afterEv) {
    if (isStage(row)) continue
    if (!beforeEv.has(id)) ops.push({ op: 'insert', table: 'events', row })
  }
  for (const [id, row] of beforeEv) {
    if (isStage(row)) continue
    if (!afterEv.has(id)) ops.push({ op: 'delete', table: 'events', id })
  }

  // application_evidence: composite PK, immutable → insert/delete keyed on pair.
  const beforeAe = byKey(prev.application_evidence as unknown[], aeKey)
  const afterAe = byKey(next.application_evidence as unknown[], aeKey)
  for (const [k, row] of afterAe) {
    if (!beforeAe.has(k)) ops.push({ op: 'insert', table: 'application_evidence', row })
  }
  for (const [k, row] of beforeAe) {
    if (!afterAe.has(k))
      ops.push({
        op: 'delete',
        table: 'application_evidence',
        match: { application_id: row.application_id, evidence_id: row.evidence_id },
      })
  }

  return ops
}

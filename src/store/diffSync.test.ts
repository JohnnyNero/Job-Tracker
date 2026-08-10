import { describe, expect, test } from 'vitest'
import { computeDiff } from './diffSync'
import { emptyDataset } from './localStore'
import type { Dataset } from '../types'

const withApp = (apps: Array<{ id: string; role: string }>): Dataset => ({
  ...emptyDataset(),
  applications: apps as unknown as Dataset['applications'],
})

const withEvents = (evs: Array<Record<string, unknown>>): Dataset => ({
  ...emptyDataset(),
  events: evs as unknown as Dataset['events'],
})

const withAe = (rows: Array<{ application_id: string; evidence_id: string }>): Dataset => ({
  ...emptyDataset(),
  application_evidence: rows as unknown as Dataset['application_evidence'],
})

describe('computeDiff', () => {
  test('insert: id present in next, absent in prev', () => {
    const ops = computeDiff(emptyDataset(), withApp([{ id: 'a1', role: 'Dev' }]))
    expect(ops).toEqual([
      { op: 'insert', table: 'applications', row: { id: 'a1', role: 'Dev' } },
    ])
  })

  test('update: same id, changed content', () => {
    const ops = computeDiff(withApp([{ id: 'a1', role: 'Dev' }]), withApp([{ id: 'a1', role: 'Lead' }]))
    expect(ops).toEqual([
      { op: 'update', table: 'applications', id: 'a1', row: { id: 'a1', role: 'Lead' } },
    ])
  })

  test('delete: id present in prev, absent in next', () => {
    const ops = computeDiff(withApp([{ id: 'a1', role: 'Dev' }]), emptyDataset())
    expect(ops).toEqual([{ op: 'delete', table: 'applications', id: 'a1' }])
  })

  test('unchanged rows produce no ops', () => {
    const same = withApp([{ id: 'a1', role: 'Dev' }])
    expect(computeDiff(same, same)).toEqual([])
  })

  test('non-stage event insert is emitted', () => {
    const ops = computeDiff(emptyDataset(), withEvents([{ id: 'ev1', kind: 'note', body: 'hi' }]))
    expect(ops).toEqual([
      { op: 'insert', table: 'events', row: { id: 'ev1', kind: 'note', body: 'hi' } },
    ])
  })

  test("'stage' events are never emitted", () => {
    const next = withEvents([{ id: 's1', kind: 'stage', body: 'applied → interview' }])
    expect(computeDiff(emptyDataset(), next)).toEqual([])
  })

  test('non-stage event delete is emitted', () => {
    const prev = withEvents([{ id: 'ev1', kind: 'note', body: 'hi' }])
    expect(computeDiff(prev, emptyDataset())).toEqual([{ op: 'delete', table: 'events', id: 'ev1' }])
  })

  test('events are never updated (immutable)', () => {
    const prev = withEvents([{ id: 'ev1', kind: 'note', body: 'a' }])
    const next = withEvents([{ id: 'ev1', kind: 'note', body: 'b' }])
    expect(computeDiff(prev, next)).toEqual([])
  })

  test('application_evidence insert is keyed on the composite pair', () => {
    const ops = computeDiff(emptyDataset(), withAe([{ application_id: 'a1', evidence_id: 'e1' }]))
    expect(ops).toEqual([
      { op: 'insert', table: 'application_evidence', row: { application_id: 'a1', evidence_id: 'e1' } },
    ])
  })

  test('multiple application_evidence rows do not collapse to one key', () => {
    const ops = computeDiff(
      emptyDataset(),
      withAe([
        { application_id: 'a1', evidence_id: 'e1' },
        { application_id: 'a2', evidence_id: 'e1' },
      ]),
    )
    expect(ops).toHaveLength(2)
  })

  test('application_evidence delete uses composite match, not id', () => {
    const ops = computeDiff(withAe([{ application_id: 'a1', evidence_id: 'e1' }]), emptyDataset())
    expect(ops).toEqual([
      {
        op: 'delete',
        table: 'application_evidence',
        match: { application_id: 'a1', evidence_id: 'e1' },
      },
    ])
  })
})

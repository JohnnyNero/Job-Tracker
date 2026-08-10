import { describe, expect, test } from 'vitest'
import { computeDiff } from './diffSync'
import { emptyDataset } from './localStore'
import type { Dataset } from '../types'

const withApp = (apps: Array<{ id: string; role: string }>): Dataset => ({
  ...emptyDataset(),
  applications: apps as unknown as Dataset['applications'],
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

  test('events table is never emitted', () => {
    const prev = emptyDataset()
    const next: Dataset = { ...emptyDataset(), events: [{ id: 'e1' } as unknown as Dataset['events'][number]] }
    expect(computeDiff(prev, next)).toEqual([])
  })
})

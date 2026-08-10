import { expect, test } from 'vitest'
import { chooseBackend } from './backend'

test('online env selects supabase', () => {
  expect(chooseBackend(true)).toBe('supabase')
})

test('no env falls back to local', () => {
  expect(chooseBackend(false)).toBe('local')
})

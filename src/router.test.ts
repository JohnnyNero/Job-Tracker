import { expect, test } from 'vitest'
import { parse } from './router'

test('parses #/group to the group route', () => {
  expect(parse('#/group')).toEqual({ name: 'group' })
})

test('parses empty hash to pipeline', () => {
  expect(parse('#')).toEqual({ name: 'pipeline' })
})

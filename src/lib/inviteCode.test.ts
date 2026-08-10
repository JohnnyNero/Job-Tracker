import { describe, expect, test } from 'vitest'
import { generateInviteCode, INVITE_ALPHABET } from './inviteCode'

describe('generateInviteCode', () => {
  test('is 8 characters', () => {
    expect(generateInviteCode()).toHaveLength(8)
  })

  test('uses only the unambiguous alphabet', () => {
    for (let i = 0; i < 50; i++) {
      for (const ch of generateInviteCode()) {
        expect(INVITE_ALPHABET).toContain(ch)
      }
    }
  })

  test('excludes ambiguous characters', () => {
    expect(INVITE_ALPHABET).not.toMatch(/[0O1IL]/)
  })
})

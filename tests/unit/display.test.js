import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { typeTitle, whoRecorded } from '../../src/utils/display.js'

describe('who recorded it', () => {
  it('your own entries say "You"', () => {
    assert.equal(whoRecorded({ createdBy: 'u1', staffName: 'Ana Reyes' }, 'u1'), 'You')
  })
  it("someone else's entries show their name", () => {
    assert.equal(whoRecorded({ createdBy: 'u2', staffName: 'Ben Cruz' }, 'u1'), 'Ben Cruz')
  })
  it('never says "You" when nobody is signed in, and has a fallback', () => {
    assert.equal(whoRecorded({ createdBy: undefined, staffName: 'Ana' }, undefined), 'Ana')
    assert.equal(whoRecorded({ createdBy: 'u2' }, 'u1'), 'Unknown')
  })
  it('titles', () => {
    assert.equal(typeTitle('cash_in'), 'Cash-in')
    assert.equal(typeTitle('cash_out'), 'Cash-out')
  })
})

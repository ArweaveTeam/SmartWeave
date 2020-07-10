/* global describe, it, before, after */

import { fullState, OWNER, testKeys } from './test-helpers/constants'
import TestHelper from './test-helpers'
import * as functionTypes from 'clearrain/functionTypes'
import { assert } from 'chai'

describe('Miscellaneous functions', function () {
  let state
  let ADMIN
  let MOD
  let MEMBER

  let helper
  let packageNExecute

  before(async function () {
    helper = new TestHelper()
    const accounts = await helper.setupEnv(testKeys)
    ADMIN = accounts[0]
    MOD = accounts[1]
    MEMBER = accounts[2]

    packageNExecute = helper.packageNExecute.bind(helper)

    state = Object.assign({}, fullState)
  })

  after(async function () {
    helper.stopIPFS()
  })

  describe('test set access of the community', function () {
    let interaction

    before(function () {
      interaction = {
        input: {
          function: functionTypes.SET_ACCESS,
          isOpen: false
        }
      }
    })

    it('owner can change access', async function () {
      const res = await packageNExecute(interaction, state, OWNER)
      state = res.state
      assert.equal(state.isOpen, false)
    })

    it('admin can change access', async function () {
      interaction.input.isOpen = true
      const res = await packageNExecute(interaction, state, ADMIN)
      state = res.state
      assert.equal(state.isOpen, true)
    })

    it('moderator attempt to change access fails', async function () {
      const res = await packageNExecute(interaction, state, MOD)
      assert.equal(res.result, 'Must have admin privileges to set access')
    })
  })

  describe('Test child community functions', function () {
    let otherCommunity
    let interaction

    before(function () {
      otherCommunity = 'some hash that point to a community id of another contract'
      interaction = {
        input: {
          function: functionTypes.ADD_CHILD,
          communityId: otherCommunity
        }
      }
    })

    it('anyone can add a child community initially', async function () {
      const res = await packageNExecute(interaction, state, MEMBER)
      state = res.state
      assert.equal(state.children[otherCommunity], true)
    })

    it('fails when someone without admin privileges tries to remove a community', async function () {
      interaction.input.function = functionTypes.REMOVE_CHILD
      const res = await packageNExecute(interaction, state, MOD)
      assert.equal(res.result, 'Caller must have admin privileges to remove a community')
    })

    it('admin can remove a community', async function () {
      const res = await packageNExecute(interaction, state, ADMIN)
      state = res.state
      assert.equal(state.children[otherCommunity], false)
    })

    it('fails to add a community that has been previously removed', async function () {
      interaction.input.function = functionTypes.ADD_CHILD
      const res = await packageNExecute(interaction, state, MOD)
      assert.equal(res.result, 'A community that has been removed can only be added back with admin privileges')
    })

    it('allows admin to add back a community', async function () {
      const res = await packageNExecute(interaction, state, ADMIN)
      state = res.state
      assert.equal(state.children[otherCommunity], true)
    })
  })
})

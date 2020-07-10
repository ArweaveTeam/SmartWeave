/* global describe, before, it, after, beforeEach */

import { initState, OWNER, testKeys } from './test-helpers/constants'
import TestHelper from './test-helpers'
import * as functionTypes from 'clearrain/functionTypes'
import { assert } from 'chai'

describe('Community Roles', function () {
  let state
  let ADMIN
  let MOD
  let MEMBER
  let MEMBER2
  let NEW_OWNER

  let helper
  let packageNExecute

  before(async function () {
    helper = new TestHelper()
    const accounts = await helper.setupEnv(testKeys)
    ADMIN = accounts[0]
    MOD = accounts[1]
    MEMBER = accounts[2]
    MEMBER2 = accounts[3]
    NEW_OWNER = accounts[4]

    packageNExecute = helper.packageNExecute.bind(helper)

    state = Object.assign({}, initState)
  })

  after(async function () {
    helper.stopIPFS()
  })

  describe('Transfer Ownership', function () {
    let interaction

    beforeEach(function () {
      interaction = {
        input: {
          function: functionTypes.TRANSFER_OWNERSHIP,
          newOwner: NEW_OWNER
        }
      }
    })

    it('successfully transfers ownership', async function () {
      const res = await packageNExecute(interaction, state, OWNER)
      assert.equal(res.type, 'ok')
      assert.equal(res.state.owner, NEW_OWNER)

      interaction.input.newOwner = OWNER
      const res2 = await packageNExecute(interaction, res.state, NEW_OWNER)
      assert.equal(res2.type, 'ok')
    })

    it('fails transfer if callerDID is not owner', async function () {
      const res = await packageNExecute(interaction, state, ADMIN)
      assert.equal(res.result, 'Must be owner to transfer ownership')
    })

    it('fails when new owner is not a valid 3ID', async function () {
      interaction.input.newOwner = 'not a did'

      const res = await packageNExecute(interaction, state, OWNER)
      assert.equal(res.result, '\'not a did\' not recognized as a valid 3ID')
    })
  })

  describe('add and remove admin', function () {
    let addInteraction
    let removeInteraction

    before(function () {
      addInteraction = {
        input: {
          function: functionTypes.ADMIN_ADD,
          admin: ADMIN
        }
      }

      removeInteraction = {
        input: {
          function: functionTypes.ADMIN_REMOVE,
          admin: ADMIN
        }
      }
    })

    it('add and remove an admin', async function () {
      let res
      async function testAdd () {
        res = await packageNExecute(addInteraction, state, OWNER)
        state = res.state
        assert.equal(state.admins[ADMIN], true)
      }

      await testAdd()

      res = await packageNExecute(removeInteraction, state, OWNER)
      state = res.state
      assert.equal(state.admins[ADMIN], false)

      await testAdd()
    })

    it('fails when not called by owner', async function () {
      const res = await packageNExecute(addInteraction, state, ADMIN)
      assert.equal(res.result, 'Must be owner to add an admin')
    })
  })

  describe('add and remove moderator', function () {
    let addInteraction
    let removeInteraction

    before(function () {
      addInteraction = {
        input: {
          function: functionTypes.MOD_ADD,
          mod: MOD
        }
      }

      removeInteraction = {
        input: {
          function: functionTypes.MOD_REMOVE,
          mod: MOD
        }
      }
    })

    async function testAdd (caller = OWNER) {
      const res = await packageNExecute(addInteraction, state, caller)
      state = res.state
      assert.equal(state.moderators[MOD], true)
    }

    it('add moderator by owner', async function () {
      await testAdd()
    })

    it('remove mod by owner', async function () {
      const res = await packageNExecute(removeInteraction, state, OWNER)
      state = res.state
      assert.equal(state.moderators[MOD], false)
    })

    it('add mod by admin', async function () {
      await testAdd(ADMIN)
    })

    it('moderator can remove themself', async function () {
      const res = await packageNExecute(removeInteraction, state, MOD)
      state = res.state
      assert.equal(state.moderators[MOD], false)
    })

    it('test add again for later testing', async function () {
      await testAdd(ADMIN) // for later testing
    })

    it('add without admin privileges fails', async function () {
      const res = await packageNExecute(addInteraction, state, MOD)
      assert.equal(res.result, 'Must be owner or admin to add a moderator')
    })
  })

  describe('test add member', function () {
    let addInteraction
    let removeInteraction

    before(function () {
      addInteraction = {
        input: {
          function: functionTypes.MEMBER_ADD,
          member: MEMBER
        }
      }

      removeInteraction = {
        input: {
          function: functionTypes.MEMBER_REMOVE,
          member: MEMBER
        }
      }
    })

    it('adds anyone to open community', async function () {
      const res = await packageNExecute(addInteraction, state, MEMBER)
      state = res.state
      assert.equal(state.members[MEMBER], true)
    })

    it('moderators and above can remove', async function () {
      const res = await packageNExecute(removeInteraction, state, MOD)
      state = res.state
      assert.equal(state.members[MEMBER], false)
    })

    it('members cannot remove', async function () {
      state = (await packageNExecute(addInteraction, state, MEMBER)).state
      addInteraction.input.member = MEMBER2
      let res = await packageNExecute(addInteraction, state, MEMBER2)
      state = res.state

      removeInteraction.input.member = MEMBER2
      res = await packageNExecute(removeInteraction, state, MEMBER)
      state = res.state
      assert.equal(res.result, 'Caller must have moderator privileges to remove a member')
    })

    it('members can remove themselves', async function () {
      const res = await packageNExecute(removeInteraction, state, MEMBER2)
      state = res.state

      assert.equal(state.members[MEMBER2], false)
    })

    it('close community and add fails', async function () {
      const closeCom = {
        input: {
          function: functionTypes.SET_ACCESS,
          isOpen: false
        }
      }

      let res = await packageNExecute(closeCom, state, OWNER)
      state = res.state
      assert.equal(state.isOpen, false)

      res = await packageNExecute(addInteraction, state, MEMBER2)
      assert.equal(res.result, 'Caller must have moderator privileges to add a member')
    })
  })
})

/* global describe, before, it, after, beforeEach */

import fs from 'fs'
import path from 'path'
import { createContractExecutionEnvironment } from '../../src/contract-load'
import { execute } from '../../src/contract-step'
import { initState, OWNER, testKeys } from './test-helpers'
import Arweave from 'arweave/node'
import * as functionTypes from 'clearrain/functionTypes'
import DidTestHelper from '3id-test-helper'
import { assert } from 'chai'
import IPFS from 'ipfs'

const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https'
})

const CONTRACT_PATH = path.resolve(__dirname, '../../build/community.js')

const contractBuffer = fs.readFileSync(CONTRACT_PATH)
const contractSrc = contractBuffer.toString()

let ipfs
let didHelper
let handler

async function packageNExecute (handler, interaction, state, caller) {
  const jwt = await didHelper.createJWTFromDID(caller, interaction)
  const res = await execute(handler, { jwt, ipfs }, state)
  return res
}

describe('Test Community', function () {
  let state
  let ADMIN
  let MOD
  let MEMBER
  let MEMBER2
  let NEW_OWNER

  before(async function () {
    handler = createContractExecutionEnvironment(arweave, contractSrc).handler
    ipfs = await IPFS.create()
    didHelper = new DidTestHelper(ipfs)

    const accounts = await didHelper.generateAccounts(testKeys)
    await didHelper.getOwner() // sets the signer for the owner did
    ADMIN = accounts[0]
    MOD = accounts[1]
    MEMBER = accounts[2]
    MEMBER2 = accounts[3]
    NEW_OWNER = accounts[4]

    state = Object.assign({}, initState)
  })

  after(async function () {
    ipfs.stop()
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
      const res = await packageNExecute(handler, interaction, state, OWNER)
      assert.equal(res.type, 'ok')
      assert.equal(res.state.owner, NEW_OWNER)

      interaction.input.newOwner = OWNER
      const res2 = await packageNExecute(handler, interaction, res.state, NEW_OWNER)
      assert.equal(res2.type, 'ok')
    })

    it('fails transfer if callerDID is not owner', async function () {
      const res = await packageNExecute(handler, interaction, state, ADMIN)
      assert.equal(res.result, 'Must be owner to transfer ownership')
    })

    it('fails when new owner is not a valid 3ID', async function () {
      interaction.input.newOwner = 'not a did'

      const res = await packageNExecute(handler, interaction, state, OWNER)
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
        res = await packageNExecute(handler, addInteraction, state, OWNER)
        state = res.state
        assert.equal(state.admins[ADMIN], true)
      }

      await testAdd()

      res = await packageNExecute(handler, removeInteraction, state, OWNER)
      state = res.state
      assert.equal(state.admins[ADMIN], false)

      await testAdd()
    })

    it('fails when not called by owner', async function () {
      const res = await packageNExecute(handler, addInteraction, state, ADMIN)
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
      const res = await packageNExecute(handler, addInteraction, state, caller)
      state = res.state
      assert.equal(state.moderators[MOD], true)
    }

    it('add moderator by owner', async function () {
      await testAdd()
    })

    it('remove mod by owner', async function () {
      const res = await packageNExecute(handler, removeInteraction, state, OWNER)
      state = res.state
      assert.equal(state.moderators[MOD], false)
    })

    it('add mod by admin', async function () {
      await testAdd(ADMIN)
    })

    it('moderator can remove themself', async function () {
      const res = await packageNExecute(handler, removeInteraction, state, MOD)
      state = res.state
      assert.equal(state.moderators[MOD], false)

      await testAdd(ADMIN) // for later testing
    })

    it('add without admin privileges fails', async function () {
      const res = await packageNExecute(handler, addInteraction, state, MOD)
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
      const res = await packageNExecute(handler, addInteraction, state, MEMBER)
      state = res.state
      assert.equal(state.members[MEMBER], true)
    })

    it('moderators and above can remove', async function () {
      const res = await packageNExecute(handler, removeInteraction, state, MOD)
      state = res.state
      assert.equal(state.members[MEMBER], false)
    })

    it('members cannot remove', async function () {
      state = (await packageNExecute(handler, addInteraction, state, MEMBER)).state
      addInteraction.input.member = MEMBER2
      let res = await packageNExecute(handler, addInteraction, state, MEMBER2)
      state = res.state

      removeInteraction.input.member = MEMBER2
      res = await packageNExecute(handler, removeInteraction, state, MEMBER)
      state = res.state
      assert.equal(res.result, 'Caller must have moderator privileges to remove a member')
    })

    it('members can remove themselves', async function () {
      const res = await packageNExecute(handler, removeInteraction, state, MEMBER2)
      state = res.state

      assert.equal(state.members[MEMBER2], false)
    })
  })
})

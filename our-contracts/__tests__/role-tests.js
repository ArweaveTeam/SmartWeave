import fs from 'fs'
import path from 'path'
import { createContractExecutionEnvironment } from '../../src/contract-load'
import { execute } from '../../src/contract-step'
import { initState, OWNER_NAME } from '../../our-contracts/community-state'
import Arweave from 'arweave/node'
import * as functionTypes from 'clearrain/functionTypes'

const ADMIN = 'did:3:ADMIN'
const MOD = 'did:3:MOD'
const MEMBER = 'did:3:MEMBER'
const MEMBER2 = 'did:3:MEMBER2'

const arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https'
})

const CONTRACT_PATH = path.resolve(__dirname, '../../build/community.js')

const contractBuffer = fs.readFileSync(CONTRACT_PATH)
const contractSrc = contractBuffer.toString()

describe('Test Community', () => {
  let handler

  it('creates execution environment', () => {
    handler = createContractExecutionEnvironment(arweave, contractSrc).handler
  })

  describe('Transfer Ownership', () => {
    let interaction
    let state = Object.assign({}, initState)
    beforeEach(() => {
      interaction = {
        input : {
          function: functionTypes.TRANSFER_OWNERSHIP,
          newOwner: 'did:3:NEW_OWNER',
          callerDID: OWNER_NAME
        },
        caller: 'blank'
      }
    })

    it('creates successful transfer', async () => {
      const res = await execute(handler, interaction, state)
      expect(res.type).toEqual('ok')

      interaction.input.callerDID = 'did:3:NEW_OWNER'
      const res2 = await execute(handler, interaction, res.state)
      expect(res2.state.owner).toEqual('did:3:NEW_OWNER')
    })

    it('fails transfer if callerDID is not owner', async () => {
      interaction.input.callerDID = 'did:3:not_owner'

      const res = await execute(handler, interaction, state)
      expect(res.result).toEqual('Must be owner to transfer ownership')
    })

    it('fails when new owner is not a valid 3ID', async () => {
      interaction.input.newOwner = 'not a did'

      const res = await execute(handler, interaction, state)
      expect(res.result).toEqual('\'not a did\' not recognized as a valid 3ID')
    })
  })

  describe('add and remove admin', () => {
    let state = Object.assign({}, initState)
    const addInteraction = {
      input: {
        function: functionTypes.ADMIN_ADD,
        admin: ADMIN,
        callerDID: OWNER_NAME
      },
      caller: 'blank'
    }

    const removeInteraction = {
      input: {
        function: functionTypes.ADMIN_REMOVE,
        admin: ADMIN,
        callerDID: OWNER_NAME
      },
      caller: 'blank'
    }


    it('add and remove an admin', async () => {
      let res
      async function testAdd () {
        res = await execute(handler, addInteraction, state)
        state = res.state
        expect(state.admins[ADMIN]).toEqual(true)
      }

      await testAdd()

      res = await execute(handler, removeInteraction, state)
      state = res.state
      expect(state.admins[ADMIN]).toEqual(false)

      await testAdd()
    })

    it('fails when not called by owner', async () => {
      addInteraction.input.callerDID = MOD
      const res = await execute(handler, addInteraction, state)
      expect(res.result).toEqual('Must be owner to add an admin')
    })
  })

  describe('add and remove moderator', () => {
    let state = Object.assign({}, initState)
    const addInteraction = {
      input: {
        function: functionTypes.MOD_ADD,
        mod: MOD,
        callerDID: OWNER_NAME
      },
      caller: 'blank'
    }

    const removeInteraction = {
      input: {
        function: functionTypes.MOD_REMOVE,
        mod: MOD,
        callerDID: OWNER_NAME
      },
      caller: 'blank'
    }

    async function testAdd () {
      let res = await execute(handler, addInteraction, state)
      state = res.state
      expect(state.moderators[MOD]).toEqual(true)
    }

    it('add moderator by owner', async () => {
      await testAdd()
    })

    it('remove mod by owner', async () => {
      let res = await execute(handler, removeInteraction, state)
      state = res.state
      expect(state.moderators[MOD]).toEqual(false)
    })

    it('add mod by admin', async () => {
      addInteraction.input.callerDID = ADMIN
      await testAdd()
    })

    it('moderator can remove themself', async () => {
      removeInteraction.input.callerDID = MOD
      let res = await execute(handler, removeInteraction, state)
      state = res.state
      expect(state.moderators[MOD]).toEqual(false)
    })

    it('add mod by admin', async () => {
      addInteraction.input.callerDID = ADMIN
      await testAdd()
    })
  })

  describe('test add member', () => {
    let state = Object.assign({}, initState)
    const addInteraction = {
      input: {
        function: functionTypes.MEMBER_ADD,
        member: MEMBER,
        callerDID: MEMBER
      }
    }

    const removeInteraction = {
      input: {
        function: functionTypes.MEMBER_REMOVE,
        member: MEMBER,
        callerDID: MOD
      }
    }

    it('adds anyone to open community', async () => {
      let res = await execute(handler, addInteraction, state)
      state = res.state
      expect(state.members[MEMBER]).toEqual(true)
    })

    it('moderators and above can remove', async () => {
      let res = await execute(handler, removeInteraction, state)
      state = res.state
      expect(state.members[MEMBER]).toEqual(false)
    })

    it('members cannot remove', async () => {
      state = (await execute(handler, addInteraction, state)).state
      addInteraction.input.member = MEMBER2
      let res = await execute(handler, addInteraction, state)
      state = res.state

      removeInteraction.input.member = MEMBER2
      removeInteraction.input.callerDID = MEMBER
      res = await execute(handler, removeInteraction, state)
      expect(res.result).toEqual('Caller must have moderator privileges to remove a member')
    })

    it('members can remove themselves', async () => {
      removeInteraction.input.callerDID = MEMBER2
      let res = await execute(handler, removeInteraction, state)
      state = res.state
      expect(state.members[MEMBER2]).toEqual(false)
    })
  })
})

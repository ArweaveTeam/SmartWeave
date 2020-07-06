import fs from 'fs'
import path from 'path'
import { createContractExecutionEnvironment } from '../../src/contract-load'
import { execute } from '../../src/contract-step'
import { initState, OWNER_NAME } from '../../our-contracts/community-state'
import Arweave from 'arweave/node'
import * as functionTypes from 'clearrain/functionTypes'

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
    let addInteraction
    let removeInteraction
    const ADMIN = 'did:3:ADMIN'
    const MOD = 'did:3:MOD'

    it('add and remove an admin', async () => {
      addInteraction = {
        input: {
          function: functionTypes.ADMIN_ADD,
          admin: ADMIN,
          callerDID: OWNER_NAME
        },
        caller: 'blank'
      }

      removeInteraction = {
        input: {
          function: functionTypes.ADMIN_REMOVE,
          admin: ADMIN,
          callerDID: OWNER_NAME
        },
        caller: 'blank'
      }

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

    it('add and remove moderator', async () => {
      addInteraction = {
        input: {
          function: functionTypes.MOD_ADD,
          mod: MOD,
          callerDID: OWNER_NAME
        },
        caller: 'blank'
      }

      removeInteraction = {
        input: {
          function: functionTypes.MOD_REMOVE,
          mod: MOD,
          callerDID: OWNER_NAME
        },
        caller: 'blank'
      }

      let res
      async function testAdd () {
        res = await execute(handler, addInteraction, state)
        state = res.state
        expect(state.moderators[MOD]).toEqual(true)
      }

      await testAdd()

      res = await execute(handler, removeInteraction, state)
      state = res.state
      expect(state.moderators[MOD]).toEqual(false)

      await testAdd()
    })
  })
})

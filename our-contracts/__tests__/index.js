import fs from 'fs'
import path from 'path'
import { createContractExecutionEnvironment } from '../../src/contract-load'
import { execute } from '../../src/contract-step'
import { initState, OWNER_NAME } from '../../our-contracts/community-state'
import Arweave from 'arweave/node'
import { functionTypes } from 'clear-rain'

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
      const res = await execute(handler, interaction, initState)
      expect(res.type).toEqual('ok')

      interaction.input.callerDID = 'did:3:NEW_OWNER'
      const res2 = await execute(handler, interaction, res.state)
      expect(res2.type).toEqual('ok')
    })

    it('fails transfer if callerDID is not owner', async () => {
      interaction.input.callerDID = 'not_owner'

      const res = await execute(handler, interaction, initState)
      expect(res.result).toEqual('Must be owner to transfer ownership')
    })

    it('fails when new owner is not a valid 3ID', async () => {
      interaction.input.newOwner = 'not a did'

      const res = await execute(handler, interaction, initState)
      expect(res.result).toEqual('\'not a did\' not recognized as a valid 3ID')
    })
  })

  describe('add and remove admin', () => {
    let state = initState
    let interaction

    beforeEach(() => {
      interaction = {
        input : {
          function: functionTypes.ADMIN_ADD,
          newOwner: 'did:3:NEW_OWNER',
          callerDID: OWNER_NAME
        },
        caller: 'blank'
      }
    })
  })
})

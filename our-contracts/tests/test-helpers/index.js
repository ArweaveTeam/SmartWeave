import fs from 'fs'
import path from 'path'
import Arweave from 'arweave/node'
import { execute } from '../../../src/contract-step'
import DidTestHelper from '3id-test-helper'
import IPFS from 'ipfs'
import wallet from './test-wallet'
import { createContractExecutionEnvironment } from '../../../src/contract-load'

const CONTRACT_ID = 'random id for testing'

const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https'
})

const CONTRACT_PATH = path.resolve(__dirname, '../../../build/community.js')

const contractBuffer = fs.readFileSync(CONTRACT_PATH)
const contractSrc = contractBuffer.toString()

let ipfs
let didHelper
let handler
let swGlobal

export default class TestHelper {
  constructor () {
    this.nonces = {}
  }

  async setupEnv (testKeys) {
    const contractInfo = createContractExecutionEnvironment(arweave, contractSrc)
    swGlobal = contractInfo.swGlobal
    handler = contractInfo.handler

    ipfs = await IPFS.create()
    didHelper = new DidTestHelper(ipfs)

    const accounts = await didHelper.generateAccounts(testKeys)
    await didHelper.getOwner() // sets the signer for the owner DID

    return accounts
  }

  async packageNExecute (interaction, state, caller) {
    const nonce = this.nonces[caller] ? this.nonces[caller] + 1 : 1

    this.nonces[caller] = nonce
    interaction.nonce = nonce
    interaction.contractId = CONTRACT_ID

    const jwt = await didHelper.createJWTFromDID(caller, interaction)

    swGlobal._activeTx = await this.getInteractionTx(jwt)

    const res = await execute(handler, { jwt, ipfs }, state)

    return res
  }

  // code taken mainly from interactWrite in contract-interact
  async getInteractionTx (input) {
    const interactionTx = await arweave.createTransaction(
      {
        data: Math.random()
          .toString()
          .slice(-4)
      },
      wallet
    )

    if (!input) {
      throw new Error(`Input should be a truthy value: ${JSON.stringify(input)}`)
    }

    interactionTx.addTag('App-Name', 'SmartWeaveAction')
    interactionTx.addTag('App-Version', '0.3.0')
    interactionTx.addTag('Contract', CONTRACT_ID)
    interactionTx.addTag('Input', JSON.stringify(input))

    // await arweave.transactions.sign(interactionTx, wallet)

    // interaction Tx needs to satisfy InteractionTx interface
    const fullTx = this.fillUnusedTxValues(interactionTx)
    return fullTx
  }

  fillUnusedTxValues (tx) {
    return {
      tx,
      info: {
        status: 200,
        confirmed: {
          block_indep_hash: 'some hash',
          block_height: 1,
          number_of_confirmations: 10
        }
      },
      id: '',
      sortKey: '',
      from: ''
    }
  }

  stopIPFS () {
    ipfs.stop()
  }
}

import Arweave from 'arweave/node'
import { JWKInterface } from 'arweave/node/lib/wallet'
import { loadContract } from './contract-load'
import { readContract } from './contract-read'
import { execute, ContractInteraction } from './contract-step'
import { InteractionTx } from './interaction-tx'
import { unpackTags } from './utils'

/**
 * Writes an interaction on the blockchain.
 *
 * This simply creates an interaction tx and posts it.
 * It does not need to know the current state of the contract.
 *
 * @param arweave       an Arweave client instance
 * @param wallet        a wallet private key
 * @param contractId    the Transaction Id of the contract
 * @param input         the interaction input, will be serialized as Json.
 */
export async function interactWrite (arweave: Arweave, wallet: JWKInterface, contractId: string, input: any) {
  const interactionTx = await createTx(arweave, wallet, contractId, input)

  const response = await arweave.transactions.post(interactionTx)

  if (response.status !== 200) return false

  return interactionTx.id
}

/**
 * This will load a contract to its latest state, and do a dry run of an interaction,
 * without writing anything to the chain.
 *
 * @param arweave       an Arweave client instance
 * @param wallet        a wallet private or public key
 * @param contractId    the Transaction Id of the contract
 * @param input         the interaction input.
 */
export async function interactWriteDryRun (arweave: Arweave, wallet: JWKInterface, contractId: string, input: any) {
  const contractInfo = await loadContract(arweave, contractId)
  const latestState = await readContract(arweave, contractId)
  const from = await arweave.wallets.jwkToAddress(wallet)

  const interaction: ContractInteraction = {
    input: input,
    caller: from
  }

  const { height, current } = await arweave.network.getInfo()

  const tx = await createTx(arweave, wallet, contractId, input)

  const tags = unpackTags(tx)

  const dummyActiveTx: InteractionTx = {
    id: tx.id,
    owner: {
      address: from
    },
    recipient: tx.target,
    tags,
    fee: {
      winston: tx.reward
    },
    quantity: {
      winston: tx.quantity
    },
    block: {
      height,
      id: current
    }
  }

  contractInfo.swGlobal._activeTx = dummyActiveTx

  return await execute(contractInfo.handler, interaction, latestState)
}

/**
 * This will load a contract to its latest state, and execute a read interaction that
 * does not change any state.
 *
 * @param arweave       an Arweave client instance
 * @param wallet        a wallet private or public key
 * @param contractId    the Transaction Id of the contract
 * @param input         the interaction input.
 */
export async function interactRead (arweave: Arweave, wallet: JWKInterface, contractId: string, input: any) {
  const contractInfo = await loadContract(arweave, contractId)
  const latestState = await readContract(arweave, contractId)
  const from = await arweave.wallets.jwkToAddress(wallet)

  const interaction: ContractInteraction = {
    input: input,
    caller: from
  }

  const { height, current } = await arweave.network.getInfo()

  const tx = await createTx(arweave, wallet, contractId, input)

  const tags = unpackTags(tx)

  const dummyActiveTx: InteractionTx = {
    id: tx.id,
    owner: {
      address: from
    },
    recipient: tx.target,
    tags,
    fee: {
      winston: tx.reward
    },
    quantity: {
      winston: tx.quantity
    },
    block: {
      height,
      id: current
    }
  }

  contractInfo.swGlobal._activeTx = dummyActiveTx

  const result = await execute(contractInfo.handler, interaction, latestState)
  return result.result
}

async function createTx (arweave: Arweave, wallet: JWKInterface, contractId: string, input: any) {
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
  interactionTx.addTag('Contract', contractId)
  interactionTx.addTag('Input', JSON.stringify(input))

  await arweave.transactions.sign(interactionTx, wallet)
  return interactionTx
}

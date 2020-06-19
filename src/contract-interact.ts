
import Arweave from 'arweave/node'
import { JWKInterface } from 'arweave/node/lib/wallet'
import { getContract } from './contract-load'
import { replayToState } from './contract-replay'
import { execute } from './contract-step'

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
export async function interactWrite(arweave: Arweave, wallet: JWKInterface, contractId: string, input: object) {

  // Use a random value in the data body. We must put 
  // _something_ in the body, because a tx must have data or target
  // to be valid. The value doesn't matter, but something sorta random 
  // helps because it will generate a different txid.
  let interactionTx = await arweave.createTransaction({
      data: Math.random().toString().slice(-4)
  }, wallet)

  interactionTx.addTag('App-Name', 'SmartWeave')
  interactionTx.addTag('Type', 'interaction')
  interactionTx.addTag('With-Contract', contractId)
  interactionTx.addTag('Version', '0.2.0')
  interactionTx.addTag('Input', JSON.stringify(input))

  await arweave.transactions.sign(interactionTx, wallet)

  const response = await arweave.transactions.post(interactionTx)

  if(response.status != 200)
      return false
  
  return interactionTx.id
}

/**
 * This will load a contract to its latest state, and do a dry run of an interaction, 
 * without writing anything to the chain. This also can be used to do interactions that 
 * dont change any state.
 * 
 * @param arweave       an Arweave client instance 
 * @param wallet        a wallet private or public key 
 * @param contractId    the Transaction Id of the contract
 * @param input         the interaction input.
 */
export async function interactWriteDryRun(arweave: Arweave, wallet: JWKInterface, contractId: string, input: object) {
  const contractInfo = await getContract(arweave, contractId);
  const latestState = await replayToState(arweave, contractId);
  const result = await execute(contractInfo.contractSrc, input, latestState, await arweave.wallets.jwkToAddress(wallet)); 
  if (!result) {
      return {
          success: false 
      }
  }
  return {
      success: true,
      state: result
  }
}
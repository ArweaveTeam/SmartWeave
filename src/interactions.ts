// Interaction that writes a state change. 
import Arweave from 'arweave/node'
import { JWKInterface } from 'arweave/node/lib/wallet'
import { getContract } from './get-contract'
import { replayToState } from './replay-contract'
import { execute } from './execute'


export async function interactWrite(arweave: Arweave, wallet: JWKInterface, contractID: string, input: object) {

  // Stick a random value in the data body. We must put 
  // _something_ in the body, because a tx must have data or target
  // to be valid. The value doesn't matter, but something sorta random 
  // helps because it will generate a different txid.
  let interactionTX = await arweave.createTransaction({
      data: Math.random().toString().slice(-4)
  }, wallet)

  interactionTX.addTag('App-Name', 'SmartWeave')
  interactionTX.addTag('Type', 'interaction')
  interactionTX.addTag('With-Contract', contractID)
  interactionTX.addTag('Version', '0.2.0')
  interactionTX.addTag('Input', JSON.stringify(input))

  await arweave.transactions.sign(interactionTX, wallet)

  const response = await arweave.transactions.post(interactionTX)

  if(response.status != 200)
      return false
  
  return interactionTX.id
}

export async function interactWriteDryRun(arweave: Arweave, wallet: JWKInterface, contractID: string, input: object) {
  const contractInfo = await getContract(arweave, contractID);
  const latestState = await replayToState(arweave, contractID);
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
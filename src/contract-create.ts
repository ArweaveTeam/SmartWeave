
import Arweave from 'arweave/node'
import { JWKInterface } from 'arweave/node/lib/wallet'

export async function createContract(arweave: Arweave, wallet: JWKInterface, contractSrc: string, initState: string, minFee: number) {
  let srcTx = await arweave.createTransaction({ data: contractSrc }, wallet)
  
  srcTx.addTag('App-Name', 'SmartWeaveContractSource')
  srcTx.addTag('App-Version', '0.3.0')
  srcTx.addTag('Content-Type', 'application/javascript');
  
  await arweave.transactions.sign(srcTx, wallet)

  const response = await arweave.transactions.post(srcTx)

  if((response.status == 200) || (response.status == 208))
      return createContractFromTx(arweave, wallet, srcTx.id, initState, minFee)
  else
      return false
}

export async function createContractFromTx(arweave: Arweave, wallet: JWKInterface, srcTXID: string, state: string, minFee: number) {
  // Create a contract from a stored source TXID, setting the default state.
  let contractTX = await arweave.createTransaction({ data: state }, wallet)
  contractTX.addTag('App-Name', 'SmartWeaveContract')
  contractTX.addTag('App-Version', '0.3.0')
  contractTX.addTag('Contract-Src', srcTXID)
  contractTX.addTag('Content-Type', 'application/json')
  if (minFee) {
      contractTX.addTag('Min-Fee', minFee.toString())
  }

  await arweave.transactions.sign(contractTX, wallet)

  const response = await arweave.transactions.post(contractTX)
  if((response.status == 200) || (response.status == 208))
      return contractTX.id
  else
      return false
}





import Arweave from 'arweave/node'
import { getTag } from './utils'

/**
 * Loads the contract source, initial state and other parameters
 * 
 * @param arweave     an Arweave client instance
 * @param contractID  the Transaction Id of the contract
 */
export async function getContract(arweave: Arweave, contractID: string) {
  
  // Generate an object containing the details about a contract in one place.
  const contractTX = await arweave.transactions.get(contractID)
  const contractSrcTXID = getTag(contractTX, 'Contract-Src')
  const minDiff = getTag(contractTX, 'Min-Diff')
  const minFee = getTag(contractTX, 'Min-Fee')
  const contractSrcTX = await arweave.transactions.get(contractSrcTXID)
  const contractSrc = contractSrcTX.get('data', {decode: true, string: true})
  const state = contractTX.get('data', {decode: true, string: true})
  
  //console.log(`${contractSrcTXID} (Src) \n`, contractSrc);
  //console.log(`${contractID} (State) \n`, state);
  
  return {
      id: contractID,
      contractSrc: contractSrc,
      initState: state,
      minDiff: minDiff,
      minFee: minFee,
      contractTX: contractTX
  }
}
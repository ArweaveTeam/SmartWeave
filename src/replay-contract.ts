import Arweave from 'arweave/node'
import Transaction from 'arweave/node/lib/transaction';
import { getContract } from './get-contract';
import { retryWithBackoff, batch, softFailWith } from 'promises-tho';
import { getTag, arrayToHex } from './utils';
import { execute } from './execute';
import { TransactionStatusResponse } from 'arweave/node/transactions';

interface FullTxInfo {
  tx: Transaction,
  info: TransactionStatusResponse,
  id: string 
  sortKey: string 
  from: string 
}

export async function replayToState(arweave: Arweave, contractID: string, height = Number.POSITIVE_INFINITY) {
        
  const contractInfo = await getContract(arweave, contractID);

  let state; 
  try {
      state = JSON.parse(contractInfo.initState);
  } catch (e) {
      throw new Error(`Unable to parse initial state for contract: ${contractID}`);
  }
  
  // Load all the interaction txs relevant to this contract. 

  // This can be made a lot cleaner with some GraphQL features, 
  // (block info in results, pagination)
  // but for now, we stick with arql and use some utils to help 
  // with concurency and retry on errors. (we can be firing off thousands of requests here) 
  
  const arql = {
      op: 'and',
      expr1: {
          op: 'equals',
          expr1: 'App-Name',
          expr2: 'SmartWeave',
      },
      expr2: {
          op: 'equals',
          expr1: 'With-Contract',
          expr2: contractID
      }
  }
  
  let transactions = await arweave.arql(arql);
  const getTxInfoFn = retryWithBackoff(
      { tries: 2, startMs: 1000 }, 
      (id) => getFullTxInfo(arweave, id)
  );
  const batcher = batch(
    { batchDelayMs: 50, batchSize: 3 },
    softFailWith(undefined, getTxInfoFn)
  )
  console.log(`Query returned ${transactions.length} interactions`);
  
  let unconfirmed = await batcher(transactions);

  console.log(`Recieved info for ${unconfirmed.length} transactions`);
  
  // Filter out txs that are not confirmed yet, not found, 
  // or are below the height we are replaying to.
  
  let txInfos = unconfirmed
    .filter(x => 
      x && 
      x.info.confirmed && 
      x.info.confirmed.block_height <= height
    ) as FullTxInfo[]
  
  console.log(`Replaying ${txInfos.length} confirmed interactions`);

  txInfos.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  
  for (let i = 0; i < txInfos.length; i++) {
      let input;
      try { 
          input = getTag(txInfos[i].tx, 'Input')
          input = JSON.parse(input);
      } catch (e) {}

      if (!input) {
          console.warn(`Skipping tx with missing or invalid Input tag - ${txInfos[i].id}`);
          continue;
      }
      
      const nextState: false | object = await execute(contractInfo.contractSrc, input, state, txInfos[i].from);
      if (!nextState) {
          console.warn(`Executing of interaction: ${txInfos[i].id} threw exception, skipping`);
          continue;
      }
      state = nextState;
  }

  return state; 
}

// This gets the full Tx Info, and calcutes a sort key.
// It needs to get the block_height and indep_hash from
// the status endpoint as well as the tx itself. Returns 
// undefined if the transactions is not confirmed. 
async function getFullTxInfo(arweave: Arweave, id: string): Promise<FullTxInfo | undefined> {
  const [tx, info] = await Promise.all([
      arweave.transactions.get(id).catch(e => {
        if (e.type === 'TX_PENDING') {
          return undefined
        } 
        throw(e);
      }),
      arweave.transactions.getStatus(id)
  ])
  
  if (!tx || !info || !info.confirmed) {
    return undefined;
  }
 
  // Construct a string that will lexographically sort.
  // { block_height, sha256(block_indep_hash + txid) }
  // pad block height to 12 digits and convert hash value 
  // to a hex string.
  const blockHashBytes = arweave.utils.b64UrlToBuffer(info.confirmed.block_indep_hash)
  const txIdBytes = arweave.utils.b64UrlToBuffer(id)
  const concatted = arweave.utils.concatBuffers([blockHashBytes, txIdBytes])
  const hashed = arrayToHex(await arweave.crypto.hash(concatted))
  const block_height = `000000${info.confirmed.block_height}`.slice(-12); 

  const sortKey = `${block_height},${hashed}`
  
  return { tx, info, id: tx.id, sortKey, from: await arweave.wallets.ownerToAddress(tx.owner) }
}


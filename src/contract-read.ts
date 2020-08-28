import Arweave from 'arweave/node'
import { loadContract } from './contract-load';
import { retryWithBackoff, batch, softFailWith } from 'promises-tho';
import { getTag, arrayToHex, unpackTags, log } from './utils';
import { execute, ContractInteraction } from './contract-step';
import { InteractionTx } from './interaction-tx';

/**
 * Queries all interaction transactions and replays a contract to its latest state. 
 * 
 * If height is provided, will replay only to that block height. 
 * 
 * @param arweave     an Arweave client instance
 * @param contractId  the Transaction Id of the contract
 * @param height      if specified the contract will be replayed only to this block height
 */
export async function readContract(arweave: Arweave, contractId: string, height = Number.POSITIVE_INFINITY): Promise<any> {
        
  const contractInfo = await loadContract(arweave, contractId);

  let state: any; 
  try {
      state = JSON.parse(contractInfo.initState);
  } catch (e) {
      throw new Error(`Unable to parse initial state for contract: ${contractId}`);
  }
  
  // Load all the interaction txs relevant to this contract. 

  // This can be made a lot cleaner with some GraphQL features, 
  // (block info in results, pagination)
  // but for now, we stick with arql and use some utils to help 
  // with concurency and retry on errors. 
  // (we can be firing off thousands of requests here) 
  
  const arql = {
      op: 'and',
      expr1: {
          op: 'equals',
          expr1: 'App-Name',
          expr2: 'SmartWeaveAction',
      },
      expr2: {
          op: 'equals',
          expr1: 'Contract',
          expr2: contractId
      }
  }
  
  let transactions = await arweave.arql(arql);
  const getTxInfoFn = retryWithBackoff(
      { tries: 3, startMs: 1000 }, 
      (id) => getFullTxInfo(arweave, id)
  );
  const batcher = batch(
    { batchDelayMs: 50, batchSize: 3 },
    softFailWith(undefined, getTxInfoFn)
  )
  log(arweave, `Query returned ${transactions.length} interactions`);
  
  let unconfirmed = await batcher(transactions);

  log(arweave, `Recieved info for ${unconfirmed.length} transactions`);
  
  // Filter out txs that are not confirmed yet, not found, 
  // or are below the height we are replaying to.
  
  let txInfos = unconfirmed
    .filter(x => 
      x && 
      x.info.confirmed && 
      x.info.confirmed.block_height <= height
    ) as InteractionTx[]
  
  log(arweave, `Replaying ${txInfos.length} confirmed interactions`);

  txInfos.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const { handler, swGlobal } = contractInfo
  
  for (let i = 0; i < txInfos.length; i++) {
      let input;
      try { 
          input = getTag(txInfos[i].tx, 'Input')
          input = JSON.parse(input);
      } catch (e) {}

      if (!input) {
          log(arweave, `Skipping tx with missing or invalid Input tag - ${txInfos[i].id}`);
          continue;
      }
      
      const interaction: ContractInteraction = {
        input: input,
        caller: txInfos[i].from,
      }
      
      swGlobal._activeTx = txInfos[i];

      const result = await execute(handler, interaction, state);
      
      if (result.type === 'exception') {
        log(arweave, `${result.result}`);
        log(arweave, `Executing of interaction: ${txInfos[i].id} threw exception.`);
      }
      if (result.type === 'error') {
        log(arweave, `${result.result}`);
        log(arweave, `Executing of interaction: ${txInfos[i].id} returned error.`);
      }
      
      state = result.state;
  }

  return state; 
}

// This gets the full Tx Info, and calcutes a sort key.
// It needs to get the block_height and indep_hash from
// the status endpoint as well as the tx itself. Returns 
// undefined if the transactions is not confirmed. 
async function getFullTxInfo(arweave: Arweave, id: string): Promise<InteractionTx | undefined> {
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


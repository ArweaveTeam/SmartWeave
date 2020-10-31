import Arweave from 'arweave';
import localPorridge from 'localporridge';
import { loadContract } from './contract-load';
import { arrayToHex, formatTags, log } from './utils';
import { execute, ContractInteraction } from './contract-step';
import { InteractionTx } from './interaction-tx';
import { GQLEdgeInterface } from './interfaces/gqlResult';

const storage = typeof localStorage !== 'undefined' ? localStorage : new localPorridge('./smartweave-cache.json');

/**
 * Queries all interaction transactions and replays a contract to its latest state.
 *
 * If height is provided, will replay only to that block height.
 *
 * @param arweave     an Arweave client instance
 * @param contractId  the Transaction Id of the contract
 * @param height      if specified the contract will be replayed only to this block height
 */
export async function readContract(arweave: Arweave, contractId: string, height?: number): Promise<any> {
  if (!height) {
    const networkInfo = await arweave.network.getInfo();
    height = networkInfo.height;
  }

  const loadPromise = loadContract(arweave, contractId).catch((err) => err);
  const fetchTxPromise = fetchTransactions(arweave, contractId, height).catch((err) => err);

  const [contractInfo, txInfos] = await Promise.all([loadPromise, fetchTxPromise]);

  if (contractInfo instanceof Error) throw contractInfo;
  if (txInfos instanceof Error) throw txInfos;

  let state: any;
  try {
    state = JSON.parse(contractInfo.initState);
  } catch (e) {
    throw new Error(`Unable to parse initial state for contract: ${contractId}`);
  }

  log(arweave, `Replaying ${txInfos.length} confirmed interactions`);

  await sortTransactions(arweave, txInfos);

  const { handler, swGlobal } = contractInfo;

  const r = storage.getItem('sw_latest');
  if(r) {
    const latest: {id: string, state: any } = JSON.parse(r);
    
    if(txInfos[txInfos.length - 1].node.id !== latest.id) {
      return latest.state;
    }
  }

  for(const txInfo of txInfos) {
    const tags = formatTags(txInfo.node.tags);

    const currentTx: InteractionTx = {
      ...txInfo.node,
      tags,
    };

    let input = currentTx.tags.Input;

    // Check that input is not an array. If a tx has multiple input tags, it will be an array
    if (Array.isArray(input)) {
      console.warn(`Skipping tx with multiple Input tags - ${currentTx.id}`);
      continue;
    }

    input = JSON.parse(input);

    if (!input) {
      log(arweave, `Skipping tx with missing or invalid Input tag - ${currentTx.id}`);
      continue;
    }

    const interaction: ContractInteraction = {
      input,
      caller: currentTx.owner.address,
    };

    swGlobal._activeTx = currentTx;

    const result = await execute(handler, interaction, state);

    if (result.type === 'exception') {
      log(arweave, `${result.result}`);
      log(arweave, `Executing of interaction: ${currentTx.id} threw exception.`);
    }
    if (result.type === 'error') {
      log(arweave, `${result.result}`);
      log(arweave, `Executing of interaction: ${currentTx.id} returned error.`);
    }

    state = result.state;
  }
  storage.setItem('sw_latest', JSON.stringify({id: txInfos[txInfos.length - 1].node.id, state}));

  return state;
}

// Sort the transactions based on the sort key generated in addSortKey()
async function sortTransactions(arweave: Arweave, txInfos: any[]) {
  const addKeysFuncs = txInfos.map((tx) => addSortKey(arweave, tx));
  await Promise.all(addKeysFuncs);

  txInfos.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

// Construct a string that will lexographically sort.
// { block_height, sha256(block_indep_hash + txid) }
// pad block height to 12 digits and convert hash value
// to a hex string.
async function addSortKey(arweave: Arweave, txInfo: any) {
  const { node } = txInfo;

  const blockHashBytes = arweave.utils.b64UrlToBuffer(node.block.id);
  const txIdBytes = arweave.utils.b64UrlToBuffer(node.id);
  const concatted = arweave.utils.concatBuffers([blockHashBytes, txIdBytes]);
  const hashed = arrayToHex(await arweave.crypto.hash(concatted));
  const blockHeight = `000000${node.block.height}`.slice(-12);

  txInfo.sortKey = `${blockHeight},${hashed}`;
}

// the maximum number of transactions we can get from graphql at once
const MAX_REQUEST = 100;

interface TagFilter {
  name: string;
  values: string[];
}

interface BlockFilter {
  max: number;
}

interface ReqVariables {
  tags: TagFilter[];
  blockFilter: BlockFilter;
  first: number;
  after?: string;
}

// fetch all contract interactions up to the specified block height
async function fetchTransactions(arweave: Arweave, contractId: string, height: number) {
  let variables: ReqVariables = {
    tags: [
      {
        name: 'App-Name',
        values: ['SmartWeaveAction'],
      },
      {
        name: 'Contract',
        values: [contractId],
      },
    ],
    blockFilter: {
      max: height,
    },
    first: MAX_REQUEST,
  };

  let transactions = await getNextPage(arweave, variables);

  const txInfos: GQLEdgeInterface[] = transactions.edges;

  while (transactions.pageInfo.hasNextPage) {
    const cursor = transactions.edges[MAX_REQUEST - 1].cursor;

    variables = {
      ...variables,
      after: cursor,
    };

    transactions = await getNextPage(arweave, variables);

    txInfos.push(...transactions.edges);
  }

  return txInfos;
}

async function getNextPage(arweave: Arweave, variables: ReqVariables) {
  const query = `query Transactions($tags: [TagFilter!]!, $blockFilter: BlockFilter!, $first: Int!, $after: String) {
    transactions(tags: $tags, block: $blockFilter, first: $first, sort: HEIGHT_ASC, after: $after) {
      pageInfo {
        hasNextPage
      }
      edges {
        node {
          id
          owner { address }
          recipient
          tags {
            name
            value
          }
          block {
            height
            id
          }
          fee { winston }
          quantity { winston }
        }
        cursor
      }
    }
  }`;

  const response = await arweave.api.post('graphql', {
    query,
    variables,
  });

  if (response.status !== 200) {
    throw new Error(`Unable to retrieve transactions. Arweave gateway responded with status ${response.status}.`);
  }

  return response.data.data.transactions;
}

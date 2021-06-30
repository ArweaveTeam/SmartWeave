import Arweave from 'arweave';
import { loadContract } from './contract-load';
import { arrayToHex, log } from './utils';
import { execute, ContractInteraction } from './contract-step';
import { InteractionTx } from './interaction-tx';
import GQLResultInterface, { GQLEdgeInterface, GQLTransactionsResultInterface } from './interfaces/gqlResult';

import SmartWeaveError, { SmartWeaveErrorType } from './errors';

const cache: {
  [contract: string]: {
    [height: number]: string;
  };
} = {};

/**
 * Queries all interaction transactions and replays a contract to its latest state.
 *
 * If height is provided, will replay only to that block height.
 *
 * @param arweave         an Arweave client instance
 * @param contractId      the Transaction Id of the contract
 * @param height          if specified the contract will be replayed only to this block height
 * @param returnValidity  if true, the function will return valid and invalid transaction IDs along with the state
 */
export async function readContract(
  arweave: Arweave,
  contractId: string,
  height?: number,
  returnValidity?: boolean,
): Promise<any> {
  if (!height) {
    const networkInfo = await arweave.network.getInfo();
    height = networkInfo.height;
  }

  if (contractId in cache) {
    if (height in cache[contractId]) {
      const res = JSON.parse(cache[contractId][height]);

      return returnValidity ? { state: res.state, validity: res.validity } : res.state;
    }
  }

  const loadPromise = loadContract(arweave, contractId).catch((err) => {
    const error: SmartWeaveError = new SmartWeaveError(SmartWeaveErrorType.CONTRACT_NOT_FOUND, {
      message: `Contract having txId: ${contractId} not found`,
      requestedTxId: contractId,
    });
    throw error;
  });
  const fetchTxPromise = fetchTransactions(arweave, contractId, height).catch((err) => err);

  let [contractInfo, txInfos] = await Promise.all([loadPromise, fetchTxPromise]);

  if (contractInfo instanceof Error) throw contractInfo;
  if (txInfos instanceof Error) throw txInfos;

  let state: any;
  let contractSrc: string = contractInfo.contractSrc;
  try {
    state = JSON.parse(contractInfo.initState);
  } catch (e) {
    throw new Error(`Unable to parse initial state for contract: ${contractId}`);
  }

  log(arweave, `Replaying ${txInfos.length} confirmed interactions`);

  await sortTransactions(arweave, txInfos);

  let { handler, swGlobal } = contractInfo;

  let validity: Record<string, boolean> = {};

  if (contractId in cache) {
    let max = 0;
    for (const item of Object.keys(cache[contractId])) {
      if (Number(item) > max && Number(item) < height) max = Number(item);
    }

    txInfos = txInfos.filter((item: { node: InteractionTx }) => item.node.block.height > max);
    const res = JSON.parse(cache[contractId][max]);
    state = res.state;
    validity = res.validity;
  }

  for (const txInfo of txInfos) {
    const currentTx: InteractionTx = txInfo.node;

    const contractIndex = txInfo.node.tags.findIndex((tag) => tag.name === 'Contract' && tag.value === contractId);
    const inputTag = txInfo.node.tags[contractIndex + 1];

    if (!inputTag || inputTag.name !== 'Input') {
      log(arweave, `Skipping tx with missing or invalid Input tag - ${currentTx.id}`);
      continue;
    }

    let input = inputTag.value;

    try {
      input = JSON.parse(input);
    } catch (e) {
      log(arweave, e);
      continue;
    }

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

    validity[currentTx.id] = result.type === 'ok';

    state = result.state;

    const evolve: string = state.evolve || state.settings?.evolve;
    if (evolve && /[a-z0-9_-]{43}/i.test(evolve) && (state.canEvolve || state.settings?.canEvolve)) {
      if (contractSrc !== state.evolve) {
        try {
          console.log('inside evolve!', state.evolve);
          contractInfo = await loadContract(arweave, contractId, evolve);
          handler = contractInfo.handler;
        } catch (e) {
          const error: SmartWeaveError = new SmartWeaveError(SmartWeaveErrorType.CONTRACT_NOT_FOUND, {
            message: `Contract having txId: ${contractId} not found`,
            requestedTxId: contractId,
          });
          throw error;
        }
      }
    }
  }

  cache[contractId] = {
    ...(cache[contractId] || {}),
    [height]: JSON.stringify({ state, validity }),
  };
  return returnValidity ? { state, validity } : state;
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

  const txInfos: GQLEdgeInterface[] = transactions.edges.filter((tx) => !tx.node.parent || !tx.node.parent.id);

  while (transactions.pageInfo.hasNextPage) {
    const cursor = transactions.edges[MAX_REQUEST - 1].cursor;

    variables = {
      ...variables,
      after: cursor,
    };

    transactions = await getNextPage(arweave, variables);

    txInfos.push(...transactions.edges.filter((tx) => !tx.node.parent || !tx.node.parent.id));
  }

  return txInfos;
}

async function getNextPage(arweave: Arweave, variables: ReqVariables): Promise<GQLTransactionsResultInterface> {
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
            timestamp
          }
          fee { winston }
          quantity { winston }
          parent { id }
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

  const data: GQLResultInterface = response.data;
  const txs = data.data.transactions;

  return txs;
}

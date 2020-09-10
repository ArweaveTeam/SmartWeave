import Arweave from 'arweave/node'
import { loadContract, createContractExecutionEnvironment } from './contract-load'
import { arrayToHex, formatTags, log } from './utils'
import { execute, ContractInteraction } from './contract-step'
import { InteractionTx } from './interaction-tx'

/**
 * Queries all interaction transactions and replays a contract to its latest state.
 *
 * If height is provided, will replay only to that block height.
 *
 * @param arweave     an Arweave client instance
 * @param contractId  the Transaction Id of the contract
 * @param height      if specified the contract will be replayed only to this block height
 */
export async function readContract (arweave: Arweave, contractId: string, height?: number): Promise<any> {
  const { state } = await syncContract(arweave, contractId, { endHeight: height })

  return state
}

interface SyncOptions {
  contractSrc: string
  startHeight: number
  endHeight: number
  state: any
  minFee: number
  // allows contracts to efficiently use dependencies that would expensive to constantly instantiate (like ipfs for interacting with DIDs)
  dependencies: object
}

interface SyncedContractInfo {
  state: any
  endHeight: number
  contractSrc: string
  minFee: number
}

/**
 * Replays a contract to its state.
 *
 * @param arweave                an Arweave client instance
 * @param contractId             the Transaction Id of the contract
 * @param options.contractSrc    The source code of the contract as a string
 * @param options.startHeight    The block height to start syncing transactions at
 * @param options.endHeight      The height to stop syncing transactions at
 * @param options.state          The state of the contract at block (options.startHeight - 1)
 * @param options.minFee         The minimum fee required for contract interactions
 * @param options.dependencies    Any inputs running the contract depends on
 */
export async function syncContract (arweave: Arweave, contractId: string, options: Partial<SyncOptions> = {}): Promise<SyncedContractInfo> {
  let endHeight = options.endHeight
  if (!endHeight) {
    const networkInfo = await arweave.network.getInfo()
    endHeight = networkInfo.height
  }

  const contractInfoPromise = getContractInfo(arweave, contractId, JSON.stringify(options.state), options.contractSrc, options.minFee).catch(err => err)
  const fetchTxPromise = fetchTransactions(arweave, contractId, endHeight, options.startHeight).catch(err => err)

  const [contractInfo, txInfos] = await Promise.all([contractInfoPromise, fetchTxPromise])

  if (contractInfo instanceof Error) throw contractInfo
  if (txInfos instanceof Error) throw txInfos

  let state: any
  try {
    state = JSON.parse(contractInfo.initState)
  } catch (e) {
    throw new Error(`Unable to parse initial state for contract: ${contractId}`)
  }

  log(arweave, `Replaying ${txInfos.length} confirmed interactions`)

  await sortTransactions(arweave, txInfos)

  const { handler, swGlobal } = contractInfo

  for (let i = 0; i < txInfos.length; i++) {
    const tags = formatTags(txInfos[i].node.tags)

    const currentTx: InteractionTx = {
      ...txInfos[i].node,
      tags
    }

    let input = currentTx.tags.Input

    // Check that input is not an array. If a tx has multiple input tags, it will be an array
    if (Array.isArray(input)) {
      console.warn(`Skipping tx with multiple Input tags - ${currentTx.id}`)
      continue
    }

    input = JSON.parse(input)

    if (!input) {
      log(arweave, `Skipping tx with missing or invalid Input tag - ${currentTx.id}`)
      continue
    }

    const interaction: ContractInteraction = {
      input,
      caller: currentTx.owner.address,
      ...options.dependencies
    }

    swGlobal._activeTx = currentTx

    const result = await execute(handler, interaction, state)

    if (result.type === 'exception') {
      log(arweave, `${result.result}`)
      log(arweave, `Executing of interaction: ${currentTx.id} threw exception.`)
    }
    if (result.type === 'error') {
      log(arweave, `${result.result}`)
      log(arweave, `Executing of interaction: ${currentTx.id} returned error.`)
    }

    state = result.state
  }

  const { minFee, contractSrc } = contractInfo

  return {
    state,
    endHeight,
    minFee,
    contractSrc
  }
}

async function getContractInfo (arweave: Arweave, contractId: string, state?: string, contractSrc?: string, minFee?: number) {
  if (state && contractSrc) {
    const { handler, swGlobal } = createContractExecutionEnvironment(arweave, contractSrc, contractId)

    return {
      initState: state,
      handler,
      swGlobal,
      minFee
    }
  }

  return await loadContract(arweave, contractId)
}

// Sort the transactions based on the sort key generated in addSortKey()
async function sortTransactions (arweave: Arweave, txInfos: any[]) {
  const addKeysFuncs = txInfos.map(tx => addSortKey(arweave, tx))
  await Promise.all(addKeysFuncs)

  txInfos.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
}

// Construct a string that will lexographically sort.
// { block_height, sha256(block_indep_hash + txid) }
// pad block height to 12 digits and convert hash value
// to a hex string.
async function addSortKey (arweave: Arweave, txInfo: any) {
  const { node } = txInfo

  const blockHashBytes = arweave.utils.b64UrlToBuffer(node.block.id)
  const txIdBytes = arweave.utils.b64UrlToBuffer(node.id)
  const concatted = arweave.utils.concatBuffers([blockHashBytes, txIdBytes])
  const hashed = arrayToHex(await arweave.crypto.hash(concatted))
  const blockHeight = `000000${node.block.height}`.slice(-12)

  txInfo.sortKey = `${blockHeight},${hashed}`
}

// the maximum number of transactions we can get from graphql at once
const MAX_REQUEST = 100

interface TagFilter {
  name: string
  values: string[]
}

interface BlockFilter {
  max: number
  min: number
}

interface ReqVariables {
  tags: TagFilter[]
  blockFilter: BlockFilter
  first: number
  after?: string
}

// fetch all contract interactions up to the specified block height
async function fetchTransactions (arweave: Arweave, contractId: string, endHeight: number, startHeight = 0) {
  let variables: ReqVariables = {
    tags: [{
      name: 'App-Name',
      values: ['SmartWeaveAction']
    },
    {
      name: 'Contract',
      values: [contractId]
    }],
    blockFilter: {
      max: endHeight,
      min: startHeight
    },
    first: MAX_REQUEST
  }

  let transactions = await getNextPage(arweave, variables)

  const txInfos = transactions.edges

  while (transactions.pageInfo.hasNextPage) {
    const cursor = transactions.edges[MAX_REQUEST - 1].cursor

    variables = {
      ...variables,
      after: cursor
    }

    transactions = await getNextPage(arweave, variables)

    txInfos.push(...transactions.edges)
  }

  return txInfos
}

async function getNextPage (arweave: Arweave, variables: ReqVariables) {
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
  }`

  const response = await arweave.api.post('graphql', {
    query,
    variables
  })

  if (response.status !== 200) {
    throw new Error(`Unable to retrieve transactions. Arweave gateway responded with status ${response.status}.`)
  }

  return response.data.data.transactions
}

import Arweave from 'arweave/node'
import { loadContract } from './contract-load'
import { arrayToHex, formatTags } from './utils'
import { execute, ContractInteraction } from './contract-step'
import { InteractionTx } from './interaction-tx'

// integers on the server are 32 bit so we can't user Number.MAX_SAFE_INTEGER
const MAX_INT_ON_SERVER = 2147483647

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
  const contractInfo = await loadContract(arweave, contractId)

  let state: any
  try {
    state = JSON.parse(contractInfo.initState)
  } catch (e) {
    throw new Error(`Unable to parse initial state for contract: ${contractId}`)
  }

  if (!height) {
    const networkInfo = await arweave.network.getInfo()
    height = networkInfo.height
  }

  const query = `query Transactions($tags: [TagFilter!]!, $blockFilter: BlockFilter!, $first: Int!) {
  transactions(tags: $tags, block: $blockFilter, first: $first, sort: HEIGHT_ASC) {
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
      }
    }
  }`

  const variables = {
    tags: [{
      name: 'App-Name',
      values: ['SmartWeaveAction']
    },
    {
      name: 'Contract',
      values: [contractId]
    }],
    blockFilter: {
      max: height
    },
    first: MAX_INT_ON_SERVER
  }

  const response = await arweave.api.post('graphql', {
    query,
    variables
  })

  if (response.status !== 200) {
    throw new Error(`Unable to retrieve transactions. Arweave gateway responded with status ${response.status}.`)
  }

  const txInfos = response.data.data.transactions.edges

  console.log(`Replaying ${txInfos.length} confirmed interactions`)

  await sortTransactions(arweave, txInfos)

  const { handler, swGlobal } = contractInfo

  for (let i = 0; i < txInfos.length; i++) {
    const tags = formatTags(txInfos[i].node.tags)

    const currentTx: InteractionTx = {
      ...txInfos[i].node,
      tags
    }

    let input = currentTx.tags.Input

    // check that input is not an array
    if (Array.isArray(input)) {
      console.warn(`Skipping tx with multiple Input tags - ${currentTx.id}`)
      continue
    }

    input = JSON.parse(input)

    if (!input) {
      console.warn(`Skipping tx with missing or invalid Input tag - ${currentTx.id}`)
      continue
    }

    const interaction: ContractInteraction = {
      input: input,
      caller: currentTx.owner.address
    }

    swGlobal._activeTx = currentTx

    const result = await execute(handler, interaction, state)

    if (result.type === 'exception') {
      console.warn(`${result.result}`)
      console.warn(`Executing of interaction: ${currentTx.id} threw exception.`)
    }
    if (result.type === 'error') {
      console.warn(`${result.result}`)
      console.warn(`Executing of interaction: ${currentTx.id} returned error.`)
    }

    state = result.state
  }

  return state
}

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

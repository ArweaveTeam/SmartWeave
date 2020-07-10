/* global ContractAssert, ContractError */

import { verifyJWT } from 'did-jwt'
import { Resolver } from 'did-resolver'
import { getResolver } from '3id-resolver'
import checkRoleOps, { hasAdminPrivileges } from './roles'
import { getTag } from './utils'
import {
  SET_ACCESS,
  ADD_CHILD,
  REMOVE_CHILD
} from 'clearrain/functionTypes'

export async function handle (state, action) {
  const payload = await getPayload(action.jwt, action.ipfs)

  // ensure the payload has the correct nonce and contract id. This prevents reusing a signature.
  checkPayload(state, payload)

  state.nonces[payload.iss] = payload.nonce

  const op = checkRoleOps(state, payload)
  if (op.isRoleOp) return { state: op.state }

  const { input } = payload

  if (input.function === SET_ACCESS) {
    ContractAssert(hasAdminPrivileges(payload.iss, state), 'Must have admin privileges to set access')

    state.isOpen = input.isOpen
    return { state }
  }

  if (input.function === ADD_CHILD) {
    // can be called by anyone if the community has not previously been removed
    // otherwise must be called by admin
    ContractAssert(isNotPreviousChild(input.communityId, state) || hasAdminPrivileges(payload.iss, state),
      'A community that has been removed can only be added back with admin privileges')

    // add check to make sure communityId is an arweave contract, will need access to arweave.transaction
    // get the transaction and then check to make sure it's App-Name is SmartWeaveContract

    state.children[input.communityId] = true

    return { state }
  }

  if (input.function === REMOVE_CHILD) {
    ContractAssert(hasAdminPrivileges(payload.iss, state), 'Caller must have admin privileges to remove a community')

    state.children[input.communityId] = false

    return { state }
  }

  throw new ContractError(`No function supplied or function not recognised: "${input.function}"`)
}

function checkPayload (state, payload) {
  const caller = payload.iss
  const prevNonce = state.nonces[caller] || 0
  ContractAssert(prevNonce + 1 === payload.nonce, 'Nonce provided in payload is invalid')

  const contractId = getTag('Contract')

  /*
   * make sure the contractId is not false. It shouldn't be if we assume interactions are queried based
   * on the contract Id but if that changes, we want to prevent the insecure workaround of setting no contractId
   * and setting payload.contractId to false
   */
  ContractAssert(contractId, 'No contract ID provided.')
  ContractAssert(contractId === payload.contractId, 'The contract ID provided is invalid.')
}

function isNotPreviousChild (communityId, state) {
  return typeof state.children[communityId] === 'undefined'
}

async function getPayload (jwt, ipfs) {
  const threeIdResolver = getResolver(ipfs)
  const resolverWrapper = new Resolver(threeIdResolver)

  let verifiedJWT
  try {
    verifiedJWT = await verifyJWT(jwt, { resolver: resolverWrapper })
  } catch (e) {
    throw new ContractError(`JWT verification failed: ${e}`)
  }

  return verifiedJWT.payload
}

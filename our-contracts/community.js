/* global ContractAssert, ContractError */

import { verifyJWT } from 'did-jwt'
import { Resolver } from 'did-resolver'
import { getResolver } from '3id-resolver'
import checkRoleOps, { hasAdminPrivileges } from './roles'
import {
  SET_ACCESS,
  CREATE_CHILD,
  REMOVE_CHILD
} from 'clearrain/functionTypes'

export async function handle (state, action) {
  const payload = await getPayload(action.jwt, action.ipfs)

  const op = checkRoleOps(state, payload)
  if (op.isRoleOp) return { state: op.state }

  const { input } = payload

  if (input.function === SET_ACCESS) {
    ContractAssert(hasAdminPrivileges(payload.iss, state), 'Must have admin privileges to set access')

    state.isOpen = input.isOpen
    return { state }
  }

  if (input.function === CREATE_CHILD) { return {} }

  if (input.function === REMOVE_CHILD) { return {} }

  throw new ContractError(`No function supplied or function not recognised: "${input.function}"`)
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

import checkRoleOps, { hasAdminPrivileges } from './roles'
import { functionTypes } from 'clear-rain'

const {
  SET_ACCESS,
  CREATE_CHILD,
  REMOVE_CHILD
} = functionTypes

export function handle(state, action)  {
  // check signature of caller DID

  let { input } = action

  const op = checkRoleOps(state, input)
  if (op.isRoleOp) return { state: op.state }

  if (input.function == SET_ACCESS) {
    ContractAssert(hasAdminPrivileges(input.callerDID, state), 'Must have admin privileges to set access')

    state.isOpen = input.isOpen
    return { state }
  }

  if (input.function == CREATE_CHILD) { return {} }

  if (input.function == REMOVE_CHILD) { return {} }

  throw new ContractError(`No function supplied or function not recognised: "${input.function}"`);
}

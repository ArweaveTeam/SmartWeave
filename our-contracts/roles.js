import {
  TRANSFER_OWNERSHIP,
  ADMIN_ADD,
  ADMIN_REMOVE,
  MOD_ADD,
  MOD_REMOVE,
  MEMBER_ADD,
  MEMBER_REMOVE
} from 'clearrain/functionTypes'

const DID_3_PREFIX = 'did:3:'

export default function checkRoleOps(state, input) {
  if (input.function == TRANSFER_OWNERSHIP) {
    ContractAssert(is3ID(input.newOwner), `'${input.newOwner}' not recognized as a valid 3ID`)
    ContractAssert(input.callerDID === state.owner, 'Must be owner to transfer ownership')

    state.owner = input.newOwner
    return { isRoleOp: true, state }
  }

  if (input.function == ADMIN_ADD) {
    ContractAssert(input.callerDID === state.owner, 'Must be owner to add an admin')
    ContractAssert(is3ID(input.admin), `'${input.admin}' not recognized as a valid 3ID`)

    state.admins[input.admin] = true
    return { isRoleOp: true, state }
  }

  if (input.function == ADMIN_REMOVE) {
    ContractAssert(isRemoveSelf(input.callerDID, input.mod) || input.callerDID === state.owner, 'Must be owner to remove an admin')
    ContractAssert(is3ID(input.admin), `'${input.admin}' not recognized as a valid 3ID`)

    state.admins[input.admin] = false
    return { isRoleOp: true, state }
  }

  if (input.function == MOD_ADD) {
    ContractAssert(hasAdminPrivileges(input.callerDID, state), 'Must be owner or admin to add a moderator')
    ContractAssert(is3ID(input.mod), `'${input.mod}' not recognized as a valid 3ID`)

    state.moderators[input.mod] = true
    return { isRoleOp: true, state }
  }

  if (input.function == MOD_REMOVE) {
    ContractAssert(isRemoveSelf(input.callerDID, input.mod) || hasAdminPrivileges(input.callerDID, state), 'Must be owner or admin to remove a moderator')
    ContractAssert(is3ID(input.mod), `'${input.mod}' not recognized as a valid 3ID`)

    state.moderators[input.mod] = false
    return { isRoleOp: true, state }
  }

  if (input.function == MEMBER_ADD) {
    ContractAssert(state.isOpen || hasModeratorPrivileges(input.callerDID, state),
      'Caller must have moderator privileges to add a member')
    ContractAssert(is3ID(input.member), `'${input.member}' not recognized as a valid 3ID`)

    state.members[input.member] = true
    return { isRoleOp: true, state }
  }

  if (input.function == MEMBER_REMOVE) {
    ContractAssert(isRemoveSelf(input.callerDID, input.member) || hasModeratorPrivileges(input.callerDID, state),
      'Caller must have moderator privileges to remove a member')
    ContractAssert(is3ID(input.member), `'${input.member}' not recognized as a valid 3ID`)

    state.members[input.member] = false
    return { isRoleOp: true, state }
  }

  return { isRoleOp: false }
}

export function hasAdminPrivileges (did, state) {
  return did === state.owner || state.admins[did]
}

function hasModeratorPrivileges (did, state) {
  return hasAdminPrivileges(did, state) || state.moderators[did]
}

function isRemoveSelf (caller, recipient) {
  return caller === recipient
}

function is3ID (did) {
  return did.startsWith(DID_3_PREFIX)
}

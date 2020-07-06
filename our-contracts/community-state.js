export const OWNER_NAME = 'did:3:owner'

const initState = {
  name: 'RAINtest',
  isOpen: true,
  owner: OWNER_NAME,
  admins: {},
  moderators: {},
  members: {},
  children: []
}

initState.admins[OWNER_NAME] = true
initState.moderators[OWNER_NAME] = true
initState.members[OWNER_NAME] = true

export { initState } 

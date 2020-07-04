export const OWNER_NAME = 'did:3:owner'

export const initState = {
  name: 'RAINtest',
  isOpen: true,
  owner: OWNER_NAME,
  admins: { OWNER_NAME: true },
  moderators: { OWNER_NAME: true },
  members: { OWNER_NAME: true },
  children: []
}

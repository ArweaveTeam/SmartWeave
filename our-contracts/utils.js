/* global SmartWeave */

export function getTag (name) {
  const tags = SmartWeave.transaction.tags

  if (tags[name]) return tags[name]

  return false
}

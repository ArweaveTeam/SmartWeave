

export async function handle(state, input) {

  const txId = SmartWeave.transaction.id 
  const txFrom = SmartWeave.transaction.owner 
  const txTarget = SmartWeave.transaction.target  
  const txQuantity = SmartWeave.transaction.quantity 
  const txReward = SmartWeave.transaction.reward
  const txTags = SmartWeave.transaction.tags 
  const blockHeight = SmartWeave.block.height
  const blockIndepHash = SmartWeave.block.indep_hash 
  
  const ownerBytes = SmartWeave.arUtils.b64UrlToBuffer(txFrom);
  const from = await SmartWeave.arCrypto.hash(ownerBytes);

  if (!state.log) {
    state.log = [];
  }
  state.log = [...state.log, { blockHeight, blockIndepHash, txId, txOwner: txFrom, txTarget,  txQuantity, txReward, txTags, from }]
  return { state }

}
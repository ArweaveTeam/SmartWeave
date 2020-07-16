

export async function handle(state, input) {

  const txId = SmartWeave.transaction.id 
  const txOwner = SmartWeave.transaction.owner 
  const txTarget = SmartWeave.transaction.target  
  const txQuantity = SmartWeave.transaction.quantity 
  const txReward = SmartWeave.transaction.reward
  const txTags = SmartWeave.transaction.tags 
  const blockHeight = SmartWeave.block.height
  const blockIndepHash = SmartWeave.block.indep_hash 
  const contractId = SmartWeave.contract.id 

  const ownerBytes = SmartWeave.arweave.utils.b64UrlToBuffer(txOwner);
  const from = 
    SmartWeave.arweave.utils.bufferToB64Url(
      await SmartWeave.arweave.utils.crypto.hash(ownerBytes)
    );
  const from2 = SmartWeave.utils.wallets.ownerToAddress(txOwner);

  state.log = [...state.log, { blockHeight, blockIndepHash, txId, txOwner: txOwner, txTarget, txQuantity, txReward, txTags, from, from2 }]
  return { state }

}
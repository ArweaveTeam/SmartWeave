// An example contract that uses the SmartWeave.unsafeClient interface to read a
// large amount of data into the smart contract.
//
// This mechanism is inherently unsafe if you have no strong guarantee that the
// transaction in question is well-seeded in the network. If you do know this,
// however, you can use this system to load large amounts of state into the
// contract.

export async function handle (state, action) {
  if (action.input.function === 'loadState') {
    const txid = action.input.txid

    state = await SmartWeave.unsafeClient.transactions.getData(txid, { decode: true, string: true })

    return { state }
  }

  throw new ContractError('Invalid input')
}

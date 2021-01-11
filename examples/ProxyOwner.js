// An example contract that uses the foreign call protocol to own and control
// tokens found in another contract.

export function handle (state, action) {
    const owner = state.owner
    const input = action.input
    const caller = action.caller
  
    if (input.function === 'transfer') {
      const target = input.target
  
      if (!target || (caller === target)) {
        throw new ContractError('Invalid target for transfer')
      }
  
      if (caller !== owner) {
        throw new ContractError(`Caller does not own the token`)
      }

      owner = target

      return { state }
    }
  
    if (input.function === 'invoke') {
      if (caller !== owner) {
        throw new ContractError(`Caller does not own the token`)
      }

      state.fcalls.push(input.invokation)

      return { state }
    }
  
    if (input.function === 'balance') {
      const target = input.target
      const ticker = state.ticker
  
      if (typeof target !== 'string') {
        throw new ContractError('Must specificy target to get balance for')
      }
  
      return { result: { target, ticker, balance: (target === owner) ? 1 : 0 } }
    }
  
    throw new ContractError(`No function supplied or function not recognised: "${input.function}"`)
}

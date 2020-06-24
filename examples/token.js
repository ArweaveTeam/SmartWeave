
export function handle(state, action) {
  
  let balances = state.balances;
  let input = action.input;
  let caller = action.caller;

  if (input.function == 'transfer') {
    let target = input.target;
    let qty = Math.trunc(input.quantity);

    if (!target) {
      throw new ContractError(`No target specified`);
    }

    if (isNaN(qty)) {
      throw new ContractError(`Invalid quantity`);
    }

    if (qty <= 0 || caller == target) {
      throw new ContractError('Invalid token transfer');
    }

    if (balances[caller] < qty) {
      throw new ContractError(`Caller balance not high enough to send ${qty} token(s)!`);
    }

    // Lower the token balance of the caller
    balances[caller] -= qty;
    if (target in balances) {
      // Wallet already exists in state, add new tokens
      balances[target] += qty;
    } else {
      // Wallet is new, set starting balance
      balances[target] = qty;
    }

    return { state };
  }

  if (input.function == 'balance') {
    let target = input.target;
    let ticker = state.ticker;
    let divisibility = state.divisibility;
    let balance = balances[target] / divisibility;
    return { result: { target, ticker, balance } };
  }

  throw new ContractError(`No function supplied or function not recognised: "${input.function}"`);
}
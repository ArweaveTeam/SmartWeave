
// Just a simple demo contract to test reading another contracts state.  
// This lets a user to register as ellible for something, based off 
// whether they are holding a certain amount of some token. 

// WARNING: Using getContractState with a user supplied contract means 
// That contracts code will be loaded and executed in whatever environment
// you are running in (users browser or your nodejs) so should not be done
// until contracts are sandboxed. You should only read from contracts you 
// have reviewed the code for. 

// getContractState will get another contracts state as it was at the same
// block height as the action. 

const TOKEN_CONTRACT = '971xuq9z7Iisn4NZgt-9w2nqZYM33RltDTwx6d3jJi0';
const MIN_AMOUNT = 5000;

export async function handle(state, action) {

  if (action.input.function === 'register') {
    const tokenContractState = await SmartWeave.contracts.getContractState(TOKEN_CONTRACT);
    const balance = tokenContractState.balances[action.caller];
    if (balance >= MIN_AMOUNT) {
      state.ellible[action.caller] = true;
      return { state }
    }

    throw new ContractError(`${action.caller} not elligble, balance is "${balance}"`);
  }

  throw new ContractError(`Unrecognized function: "${action.input.function}"`)
}
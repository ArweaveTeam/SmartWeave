
// Just a simple demo contract to test reading another contracts state.  
// This lets a user to register as eligible for something, based off 
// whether they are holding a certain amount of some token. 

// WARNING: Using readContractState with a user supplied contract means 
// That contracts code will be loaded and executed in whatever environment
// you are running in (users browser or your nodejs) so should not be done
// until contracts are sandboxed. You should only read from contracts you 
// have reviewed the code for. 

// readContractState will get another contracts state as it was at the same
// block height as the action. 

const TOKEN_CONTRACT = 'wZYLq8315Qnp2UEWxH3dG-9Q1ezvESB6xYh-auZZelI';
const MIN_AMOUNT = 5000;

export async function handle(state, action) {

  if (action.input.function === 'register') {
    const tokenContractState = await SmartWeave.contracts.readContractState(TOKEN_CONTRACT);
    const balance = tokenContractState.balances[action.caller];
    if (balance >= MIN_AMOUNT) {
      state.eligible[action.caller] = true;
      return { state }
    }

    throw new ContractError(`${action.caller} not eligible, balance is "${balance}"`);
  }

  throw new ContractError(`Unrecognized function: "${action.input.function}"`)
}

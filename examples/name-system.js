// A simple name system: 
// Supports just one level of names. 
// Supports transferring a name.
// Supports associating a string with a name. 
// Supports giving up a name.

// Note: this is untested example atm. 

// TODO: require a minimum reward or burn of Ar to register a name.

export function handle(state, action) {

  if (action.input.function === 'register') {

    if (typeof action.input.name !== 'string' || action.input.name < 3) {
      throw new ContractError(`Invalid name provided: ${action.input.name}`);
    }
    if (typeof action.input.data !== 'string') {
      throw new ContractError(`Must provide data to be associated with the name`);
    }
    if (state.names[action.input.name]) {
      throw new ContractError(`Name already registered`);
    }
    state.names[action.input.name] = {
      ownedBy: action.caller, 
      data: action.input.data
    }

    return { state }
  }

  if (action.input.function === 'update') {

    if (typeof action.input.name !== 'string' || action.input.name < 3) {
      throw new ContractError(`Invalid name provided: ${action.input.name}`);
    }
    if (typeof action.input.data !== 'string') {
      throw new ContractError(`Must provide data to be associated with the name`);
    }
    if (!state.names[action.input.name]) {
      throw new ContractError(`Name not registered`);
    }
    if (!state.names[action.input.name].ownedBy !== action.caller) {
      throw new ContractError(`Name not owned by caller`);
    }

    state.names[action.input.name].data = action.input.data;
    
    return { state }
  }

  if (action.input.function === 'transfer') {

    if (typeof action.input.name !== 'string' || action.input.name < 3) {
      throw new ContractError(`Invalid name provided: ${action.input.name}`);
    }
    if (typeof action.input.target !== 'string') {
      throw new ContractError(`Must provide a target to transfer the name to`);
    }
    if (!state.names[action.input.name]) {
      throw new ContractError(`Name not registered`);
    }
    if (!state.names[action.input.name].ownedBy !== action.caller) {
      throw new ContractError(`Name not owned by caller`);
    }

    state.names[action.input.name].ownedBy = action.input.target;
    
    return { state }
  }


  if (action.input.function === 'giveup') {

    if (typeof action.input.name !== 'string' || action.input.name < 3) {
      throw new ContractError(`Invalid name provided: ${action.input.name}`);
    }
    if (!state.names[action.input.name]) {
      throw new ContractError(`Name not registered`);
    }
    if (!state.names[action.input.name].ownedBy !== action.caller) {
      throw new ContractError(`Name not owned by caller`);
    }

    delete state.names[action.input.name];
    
    return { state }
  }

  throw new ContractError(`Invalid input`);
}

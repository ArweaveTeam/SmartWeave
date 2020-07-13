
// This contract is a token contract that supports divisibility. 
// As long as the max supply of the token is <= Number.MAX_SAFE_INTEGER 
// This will work fine, (all operations are done as integer values) 

export function handle(state, action) {
  
  let balances = state.balances;
  let allownance = state.allownance;
  let input = action.input;
  let caller = action.caller;

  /**
   * @method name
   * @return {string} name of the token
   */
  if (input.function == 'name') {
    return state.name;
  }

  /**
   * @method symbol
   * @return {string} symbol of the token
   */
  if (input.function == 'symbol') {
    return state.symbol;
  }

  /**
   * @method decimals
   * @return {number} the number of decimals the token ueses
   */
  if (input.function == 'decimals') {
    return state.decimals;
  }

  /**
   * @method totalSupply
   * @return {number} the total token supply
   */
  if (input.function == 'totalSupply') {
    return state.totalSupply;
  }

  /**
   * @method balanceOf
   * @param {string} target the address
   * @return {number} token balance of the target address
   */
  if (input.function == 'balanceOf') {

    let target = input.target;
    
    if (typeof target !== 'string') {
      throw new ContractError(`Must specificy target to get balance for`);
    }
    if (typeof balances[target] !== 'number') {
      throw new ContractError(`Cannnot get balance, target does not exist`);
    }

    return balances[target];
  }

  /**
   * @method transfer
   * @param {string}  to    target address
   * @param {number}  value the amount of tokens
   * @return {boolean} success or not
   */
  if (input.function == 'transfer') {

    let to = input.to;
    let value = input.value;
    
    if (isNaN(value)) {
      throw new ContractError(`Invalid quantity`);
    }

    if (!to) {
      throw new ContractError(`No target specified`);
    }

    if (value <= 0 || caller == to) {
      throw new ContractError('Invalid token transfer');
    }

    if (balances[caller] < value) {
      throw new ContractError(`Caller balance not high enough to send ${value} token(s)!`);
    }

    // Lower the token balance of the caller
    balances[caller] -= value;
    if (to in balances) {
      // Wallet already exists in state, add new tokens
      balances[to] += value;
    } else {
      // Wallet is new, set starting balance
      balances[to] = value;
    }

    return true;
  }

  /**
   * @method transferFrom
   * @param {string}  from  from address
   * @param {string}  to    target address
   * @param {number}  value the amount of tokens
   * @return {boolean} success or not
   */
  if (input.function == 'transferFrom') {

    let from = input.from;
    let to = input.to;
    let value = input.value;

    if (isNaN(value)) {
      throw new ContractError(`Invalid quantity`);
    }

    if (!from || !to) {
      throw new ContractError(`No target specified`);
    }

    if (value <= 0 || from == to) {
      throw new ContractError('Invalid token transfer');
    }

    if (balances[from] < value) {
      throw new ContractError(`Caller balance not high enough to send ${value} token(s)!`);
    }

    if (allownance[from][caller] < value) {
      throw new ContractError(`Caller is not allowed to withdraw ${value} token(s) from ${from}!`);
    }

    // Lower the token balance of the caller
    balances[from] -= value;

    if (to in balances) {
      // Wallet already exists in state, add new tokens
      balances[to] += value;
    } else {
      // Wallet is new, set starting balance
      balances[to] = value;
    }

    return true;
  }

  /**
   * @method approve
   * @param {string} spender the address which is approved by caller
   * @param {number} value the token amount
   * @return {boolean} success of not
   */
  if (input.function == 'approve') {

    let spender = input.spender;
    let value = input.value;

    if (isNaN(value)) {
      throw new ContractError(`Invalid quantity`);
    }

    if (!spender) {
      throw new ContractError(`No target specified`);
    }

    let allownanceInfo = { spender: value };
    allownance[caller] = allownanceInfo;

    return true;
  }

  /**
   * @method allownce
   * @return {number} the amount which spender is still allowed to withdraw with owner 
   */
  if (input.function == 'allowance') {

    let owner = input.owner;
    let spender = input.spender;

    if (!owner || !spender) {
      throw new ContractError(`No target specified`);
    }

    return allownance[owner][spender];
  }

  throw new ContractError(`No function supplied or function not recognised: "${input.function}"`);
}
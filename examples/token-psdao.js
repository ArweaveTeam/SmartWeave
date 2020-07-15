
export function handle(state, action) {
  
  let balances = state.balances;
  let votes = state.votes;
  let input = action.input;
  let caller = action.caller;
  let voteLength = state.voteLength;
  let currentHeight = 0; // TODO: Get current height
  let quorum = state.quorum;

  if (input.function == 'transfer') {

    let target = input.target;
    let qty = input.qty;

    if (!Number.isInteger(qty)) {
      throw new ContractError(`Invalid value for "qty". Must be an integer`);
    }

    if (!target) {
      throw new ContractError(`No target specified`);
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
    
    if (typeof target !== 'string') {
      throw new ContractError(`Must specificy target to get balance for`);
    }

    if (typeof balances[target] !== 'number') {
      throw new ContractError(`Cannnot get balance, target does not exist`);
    }

    return { result: { target, ticker, balance: balances[target] } };
  }

  if (input.function == 'propose') {
    let voteType = input.type;

    if (voteType == 'mint') {
      let recipient = input.recipient;
      let qty = input.qty;
      let note = intput.note;

      if (!recipient) {
        throw new ContractError(`No recipient specified`);
      }

      if (!Number.isInteger(qty)) {
        throw new ContractError(`Invalid value for "qty". Must be an integer`);
      }

      if (!((typeof note == "string") && (note.length == 43))) {
        throw new ContractError(`Note format not recognised`)
      }
      
      let vote =
        {
          'status': "active",
          'type': 'mint',
          'recipient': recipient,
          'qty': qty,
          'note': note,
          'yays': 0,
          'nays': 0,
          'voted': [],
          'start': currentHeight
        };
      
      votes.push(vote);

      return { state };
    }

    if (voteType == 'set') {

      if (typeof input.key !== "string") {
        throw new ContractError(`Data type of key not supported`)
      }

      let vote =
        {
          'status': "active",
          'type': 'set',
          'key': input.key,
          'value': input.value,
          'yays': 0,
          'nays': 0,
          'voted': [],
          'start': currentHeight
        };
      
      votes.push(vote);

      return { state };

    }
  }

  if (input.function == 'vote') {

    let id = input.id;
    let cast = input.cast;

    if (!Number.isInteger(id)) {
      throw new ContractError(`Invalid value for "id". Must be an integer`);
    }

    let vote = votes[id];

    // TODO: Get balances at vote creation height
    let voterBalance = balances[caller];

    if (vote.voted.includes(caller)) {
      throw new ContractError(`Caller has already voted`);
    }

    if ((vote.start + voteLength) >= currentHeight) {
      throw new ContractError(`Vote has already concluded`);
    }

    if (cast == 'yay') {
      vote.yays += voterBalance;
    }
    else if (cast == 'nay') {
      vote.nays += voterBalance;
    }
    else {
      throw new ContractError(`Vote cast type unrecognised`);
    }

    vote.voted.push(caller)

    return { state };
  }

  if (input.type == "finalise") {

    let id = input.id;
    let vote = votes[id];

    if ((vote.start + voteLength) < currentHeight) {
      throw new ContractError(`Vote has not yet concluded`);
    }

    if (vote.status !== "active") {
      throw new ContractError(`Vote is not active`);
    }

    let totalSupply = sum(balances);

    if((totalSupply * quorum) > (vote.yays + vote.nays)) {
      vote.status = "quorumFailed";
      return state;
    }

    if (vote.yays > vote.nays) {
      vote.status = "passed";

      if (vote.type == 'mint') {

        if (vote.recipient in balances) {
          // Wallet already exists in state, add new tokens
          balances[vote.recipient] += qty;
        } else {
          // Wallet is new, set starting balance
          balances[vote.recipient] = qty;
        }

      }
      else if (vote.type == 'set') {
        state[vote.key] = vote.value
      }

    } else {
      vote.status = "failed"
    }

    return state;
  }

  throw new ContractError(`No function supplied or function not recognised: "${input.function}"`);
}

function sum(obj) {
  return Object.keys(obj).reduce((sum,key)=>sum+parseFloat(obj[key]||0),0);
}
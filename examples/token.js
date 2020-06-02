let opts = JSON.parse(input)
state = JSON.parse(state)
let balances = state.balances

if(opts.function == "transfer") {
    let target = opts.target
    let qty = Math.trunc(opts.quantity)

    if((qty <= 0) || (caller == target)) {
        throw "Invalid token transfer."
    }

    // Don't do anything unless we have enough tokens
    if(balances[caller] >= qty) {
        // Lower the token balance of the caller
        balances[caller] -= qty
        if(target in balances) {
            // Wallet already exists in state, add new tokens
            balances[target] += qty
        }
        else {
            // Wallet is new, set starting balance
            balances[target] = qty
        }
        state.balances = balances
        state = JSON.stringify(state)
    }
    else {
        throw "Caller balance not high enough to send " + qty + " token(s)!"
    }
}
else if(opts.function == "balance") {
    let target = opts.target
    let ticker = state.ticker
    let divisibility = state.divisibility
    let balance = balances[target] / divisibility
    console.log(
        "The balance of wallet " + target +
        " is " + balance + " " + ticker + ".")
}
else {
    throw "Function not recognised."
}
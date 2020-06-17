let balances = state.balances

if(input.function == "transfer") {
    
    let target = input.target
    let qty = Math.trunc(input.quantity)

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
    }
    else {
        throw "Caller balance not high enough to send " + qty + " token(s)!"
    }
}
else if(input.function == "balance") {
    let target = input.target
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
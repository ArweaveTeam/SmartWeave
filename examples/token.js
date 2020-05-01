// WARNING: DO NOT USE THIS CONTRACT.
// It has not been tested thoroughly, let alone audited.
// Here be dragons of token loss.

let opts = JSON.parse(input)
state = JSON.parse(state)
let wl = state.walletList

if(opts.function == "transfer") {
    // Welp. Looks like you are ignoring the warnings. YOLO.
    let target = opts.target
    let qty = Math.trunc(opts.quantity)

    if((qty <= 0) || (caller == target)) {
        throw "Invalid token transfer."
    }

    // Don't do anything unless we have enough tokens
    if(getBalance(caller) >= qty) {
        // Lower the token balance of the caller
        wl = modifyWallet(wl, caller, -qty)
        if(getBalance(target) !== undefined) {
            // Wallet already exists in state, add new tokens
            wl = modifyWallet(wl, target, qty)
        }
        else {
            // Wallet is new, set starting balance
            wl.push({"addr": target, "balance": qty})
        }
        state.walletList = wl
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
    let balance = getBalance(target) / divisibility
    console.log(
        "The balance of wallet " + target +
        " is " + balance + " " + ticker + ".")
}
else {
    throw "Function not recognised."
}

// Helpers
function modifyWallet(wl, addr, mod) {
    for(let i = 0; i < wl.length; i++) {
        if((wl[i].addr == addr)) {
            wl[i].balance += mod
            return wl
        }
    }
    return false
}

function getBalance(addr) {
    for(let i = 0; i < wl.length; i++) {
        if((wl[i].addr == addr)) {
            return wl[i].balance
        }
    }
    return undefined
}
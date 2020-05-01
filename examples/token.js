// WARNING: DO NOT USE THIS CONTRACT.
// It has not been tested, let alone audited. Here be dragons of token loss.

let opts = JSON.parse(input)
let wallet_list = JSON.parse(state)

if(opts.function == "transfer") {
    // Welp. Looks like you are ignoring the warnings. YOLO.
    let target = opts.target
    let qty = opts.quantity

    console.log("Transferring "
        + qty + " token(s) from "
        + caller + " to "
        + target + ".")

    // Don't do anything unless we have enough tokens
    if(getBalance(caller) >= qty) {
        // Lower the token balance of the caller
        let wl = modifyWallet(wallet_list, caller, -qty)
        if(getBalance(target) !== undefined) {
            // Wallet already exists in state, add new tokens
            wl = modifyWallet(wl, target, qty)
        }
        else {
            // Wallet is new, set starting balance
            wl.push({"addr": target, "balance": qty})
        }
        state = JSON.stringify(wl)
    }
    else {
        throw "Caller balance not high enough to send " + qty + " token(s)!"
    }
}
else if(opts.function == "balance") {
    let target = opts.target
    console.log(getBalance(target))
}
else {
    throw "Function not recognised."
}

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
    for(let i = 0; i < wallet_list.length; i++) {
        if((wallet_list[i].addr == addr)) {
            return wallet_list[i].balance
        }
    }
    return undefined
}
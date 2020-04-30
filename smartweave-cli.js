// Include dependencies.
const fs = require('fs')
const Arweave = require('arweave/node')
const argv = require('yargs').argv
const smartweave = require('./smartweave')

// Set Arweave parameters from commandline or defaults.
const arweave_port = argv.arweavePort ? argv.arweavePort : 443
const arweave_host = argv.arweaveHost ? argv.arweaveHost : 'arweave.net'
const arweave_protocol = argv.arweaveProtocol ? argv.arweaveProtocol : 'https'

if(!argv.walletFile) {
    console.log("ERROR: Please specify a wallet file to load using argument " +
        "'--wallet-file <PATH>'.")
    process.exit()
}

const raw_wallet = fs.readFileSync(argv.walletFile)
const wallet = JSON.parse(raw_wallet)

const arweave = Arweave.init({
    host: arweave_host, // Hostname or IP address for an Arweave node
    port: arweave_port,
    protocol: arweave_protocol
})

if(argv.create) {
    if(!argv.contractSrc) {
        console.log("ERROR: Please specify contract source bundle using argument " +
            "'--contract-src <PATH>'.")
        process.exit()
    }
    const contractSrc = fs.readFileSync(argv.contractSrc)

    if(!argv.initState) {
        console.log("ERROR: Please specify a file defining an initial state with " +
            "'--init-state <PATH>'.")
        process.exit()
    }

    const minDiff = argv.minDiff ? argv.minDiff : 10

    const initState = fs.readFileSync(argv.initState)

    smartweave.createContract(arweave, wallet, contractSrc, initState, minDiff).then(
        (contractID) => {
            console.log("Contract created in TX: " + contractID)
        }
    )
    
}

if(argv.interact) {
    if(!argv.contract) {
        console.log("ERROR: Please specify a contract to interact with using " +
            "'--contract <TXID>'.")
        process.exit()
    }
    const contractID = argv.contract
    let input = undefined
    let dryRun = (argv.dryRun) ? true : false

    if(argv.inputFile) {
        input = fs.readFileSync(argv.inputFile)
    }
    else if(argv.input) {
        input = argv.input
    }
    else {
        console.log("ERROR: Please specify input to the contract using " +
            "'--input \"INPUT VAR\"' or '--input-file <FILE>'.")
        process.exit()
    }

    smartweave.interact(arweave, wallet, contractID, input, dryRun).then(
        (result) => {
            if(result) {
                console.log("Result:\n" + result)
            }
            else {
                console.log("ERROR: Contract execution on input failed.\n" +
                    "Input:\n" + input +
                    "\n")
            }
        }
    )
}

if(argv.getState) {
    if(!argv.contract) {
        console.log("ERROR: Please specify a contract to interact with using " +
            "'--contract <TXID>'.")
        process.exit()
    }
    const contractID = argv.contract

    smartweave.getState(arweave, contractID).then(
        (state) => {
            if(!state) {
                console.log("ERROR: Failed to get state for contract: " + contractID)
            }
        
            console.log(state)
        }
    )
}
#!/usr/bin/env node

// Include dependencies.
const fs = require('fs')
const Arweave = require('arweave/node')
const argv = require('yargs').argv
const smartweave = require('../')

// Set Arweave parameters from commandline or defaults.
const arweavePort = argv.arweavePort ? argv.arweavePort : 443
const arweaveHost = argv.arweaveHost ? argv.arweaveHost : 'arweave.dev'
const arweaveProtocol = argv.arweaveProtocol ? argv.arweaveProtocol : 'https'

if (!argv.keyFile && !argv.walletFile) {
  console.log('ERROR: Please specify a wallet file to load using argument ' +
        "'--key-file <PATH>'.")
  process.exit()
}

const rawWallet = fs.readFileSync(argv.keyFile || argv.walletFile)
const wallet = JSON.parse(rawWallet)

const arweave = Arweave.init({
  host: arweaveHost, // Hostname or IP address for an Arweave node
  port: arweavePort,
  protocol: arweaveProtocol
})

if (argv.create) {
  if (!argv.contractSrc && !argv.contractSrcTx) {
    console.log('ERROR: Please specify contract source bundle using argument ' +
            "'--contract-src <PATH>' or --contract-src-tx <TX>.")
    process.exit()
  }

  if (!argv.initState) {
    console.log('ERROR: Please specify a file defining an initial state with ' +
            "'--init-state <PATH>'.")
    process.exit()
  }

  if (argv.contractSrc) {
    // Create from a new source file.
    const contractSrc = fs.readFileSync(argv.contractSrc)
    const minFee = argv.minFee ? argv.minFee : ''
    const initState = fs.readFileSync(argv.initState)

    smartweave.createContract(arweave, wallet, contractSrc, initState, minFee).then(
      (contractID: string) => {
        console.log('Contract created in TX: ' + contractID)
      }
    )
  } else {
    // Create from existing tx.
    const minFee = argv.minFee ? argv.minFee : ''
    const initState = fs.readFileSync(argv.initState)
    const contractSrcTx = argv.contractSrcTx
    smartweave.createContractFromTx(arweave, wallet, contractSrcTx, initState, minFee).then(
      (contractID: string) => {
        console.log('Contract created in TX: ' + contractID)
      }
    )
  }
}

if (argv.interact) {
  if (!argv.contract) {
    console.log('ERROR: Please specify a contract to interact with using ' +
            "'--contract <TXID>'.")
    process.exit()
  }
  const contractID = argv.contract
  let input: string = ''
  const dryRun = !!(argv.dryRun)

  if (argv.inputFile) {
    input = fs.readFileSync(argv.inputFile).toString()
  } else if (argv.input) {
    input = argv.input
  } else {
    console.log('ERROR: Please specify input to the contract using ' +
            "'--input \"INPUT VAR\"' or '--input-file <FILE>'.")
    process.exit()
  }

  if (!dryRun) {
    smartweave.interactWrite(arweave, wallet, contractID, JSON.parse(input))
      .then((result: any) => {
        if (result) {
          console.log('Result:\n' + result)
        } else {
          console.log('ERROR: Contract execution on input failed.\n' +
                        'Input:\n' + input +
                        '\n')
        }
      }
      )
  }

  if (dryRun) {
    console.log('Dry running')
    smartweave.interactWriteDryRun(arweave, wallet, contractID, JSON.parse(input))
      .then((result: any) => {
        console.log(result)
      })
  }
}

if (argv.getState) {
  if (!argv.contract) {
    console.log('ERROR: Please specify a contract to interact with using ' +
            "'--contract <TXID>'.")
    process.exit()
  }
  const contractID = argv.contract

  smartweave.readContract(arweave, contractID).then(
    (state: any) => {
      if (!state) {
        console.log('ERROR: Failed to get state for contract: ' + contractID)
      }

      console.log(state)
    }
  )
}

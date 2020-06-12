# SmartWeave
## Simple, scalable smart contracts on the Arweave protocol.

Uses lazy-evaluation to move the burden of contract execution from network nodes 
to smart contract users. Currently, SmartWeave supports JavaScript, using the 
client's unmodified execution engine.

**Status: 0.1**

**Use at your own risk!**

## Usage

Clone this repository and run `npm install`.

You can deploy a contract as follows:

```
node smartweave-cli.js --wallet-file [YOUR KEYFILE] \
        --create --contract-src [SRC LOCATION] \
        --init-state [INITIAL STATE FILE]
```

Check its state:

```
node smartweave-cli.js --wallet-file [YOUR KEYFILE] \
        --contract [CONTRACT TXID] \
        --get-state
```

Interact with it:

```
node smartweave-cli.js --wallet-file [YOUR KEYFILE] \
        --contract [CONTRACT TXID] \
        --interact \
        --input "[CONTRACT INPUT STRING HERE]"
```

To test a contract interaction without writing it to the network, append 
`--dry-run` to your `--interact` call.

## Execution Environment

The SmartWeave 1.0-ALPHA-1 execution environment is extremely flexible, but 
very basic. There are no safety rails. You can write programs that do far more 
computation than Ethereum (etc.) smart contracts, make use of GPU rendering 
facilities, write to the local machine's storage. But you can also trivally 
write a contract that forks when people use it in a browser vs via Node.js, due 
to environmental differences (for example).

The rules are simple:

- Your entire contract file will be executed by the local javascript execution 
environment as a script when the contract is invoked.
- The current state of the contract is found in the `state` variable upon 
invocation. The value found in the `state` variable after the contract has 
executed will be written to the Arweave so that it can be imported in the next 
contract run. The value of the variable should be a string.
- The input to the current contract execution is found in the `input` variable, 
as a string.
- The address of the wallet that is invoking the contract can be found in the 
`caller` variable.

Sample contracts and initial states can be found in the `examples` directory.

## License

Public domain.

# SmartWeave

## Simple, scalable smart contracts on the Arweave protocol

Uses lazy-evaluation to move the burden of contract execution from network nodes
to smart contract users. Currently, SmartWeave supports JavaScript, using the
client's unmodified execution engine.

**Version: 0.3**

SmartWeave contracts operate on a simple model, the state of a contract
is derived from:

1. An initial state
2. A contract function
3. An ordered list of actions

In functional programming terms this is just a fold or reduce operation. In pseudo-code it looks like this:

```javascript
initState = { ... }
contract = (state, action) => state
actions = [ action, action, action, ...]

state = initState

foreach (a in actions) {
  state = contract(state, a)
}

// state is now the latest contract state.
```

The ordering of actions, is determined, firstly, by when they are mined in the chain, and secondly, by `sha256(transactionId + blockHash)`. So, the full ordering is `[ block_height, sha256(transactionId + blockHash) ]`. In this way they inherit the same consensus properties and finality of the chain, and influencing the order of transactions in a particular block is at least as expensive as mining a block.

## Writing a contract

A contract is in the format of an ES Module that exports one function `handle`. It is initialized with
an initial state from a corresponding json file. Both the contract module and the initial state are written to the Arweave blockchain as data transactions. Below is a hello world contract, it waits for people to say the two words 'Hello' and 'World' to it (as inputs) and once it has seen both it sets its state to `happy: true`

Contract Source:

```javascript

export function handle(state, action) {
  if (action.input.say === 'Hello') {
    state.heardHello = true;
  }
  if (action.input.say === 'World') {
    state.heardWorld = true;
  }
  if (state.heardHello && state.heardWorld) {
    state.happy = true;
  }
  return { state }
}
```

Contract initial state:

```json
{
  "heardHello": false,
  "heardWorld": false,
  "happy": false
}
```

The contract takes it's latest state and an action argument. The action argument is an object containing two value, "input" and "caller". `input` is the input the contract, it is user controlled, and will be passed through JSON.parse() before the contract handler is executed. `caller` is the wallet address of the user who is calling the contract.

The contract should return an object like one of `{ state: newState }` or `{ result: someResult }`. The latter is used in the case where the action was a read, and did not update any state, it can be any truthy javascript value.

You can view more contract examples in the [examples/](examples/) folder.

## Contract writing guidelines

Contract must be deterministic! As of SmartWeave v0.3 they run in a full Js environment, so can do a lot of things, but it's trivially easy to write a contract that forks due to non-deterministic operations, or environment differences. Some things you should never do inside a contract:

- Any network operation
- Any random number generation
- Any operation that would give different results depending on the environment
- Any operation that would give different results when run at different times.

The contract function should be [Pure Function](https://en.wikipedia.org/wiki/Pure_function), always giving the same result for the same input, and having no side-effects.

In addition, you should be *very careful to sanitize the input object*, since it is user controlled you should be very strict and check it is the exact format you expect. See [examples/token.js](examples/token.js) where we check the input value `qty` is a number, is non-negative, and some other checks, and throw errors if any of them fail.

## CLI Usage

Clone this repository and run `npm install`.

You can deploy a contract as follows:

```
node smartweave-cli.js --key-file [YOUR KEYFILE] \
  --create --contract-src [SRC LOCATION] \
  --init-state [INITIAL STATE FILE]
```

Check its state:

```
node smartweave-cli.js --key-file [YOUR KEYFILE] \
  --contract [CONTRACT TXID] \
  --get-state
```

Interact with it:

```
node smartweave-cli.js --key-file [YOUR KEYFILE] \
  --contract [CONTRACT TXID] \
  --interact \
  --input "[CONTRACT INPUT STRING HERE]"
```

To test a contract interaction without writing it to the network, append `--dry-run` to your `--interact` call.

## License

Public domain.

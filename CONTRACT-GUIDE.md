# Contract Writing Guide

- [Contract Writing Guide](#contract-writing-guide)
  - [Introduction](#introduction)
  - [Hello World Contract](#hello-world-contract)
  - [Contract Format and Interface](#contract-format-and-interface)
  - [Contract Writing Guidelines](#contract-writing-guidelines)
  - [SmartWeave Global API](#smartweave-global-api)

## Introduction

SmartWeave contracts operate on a simple model, the state of a contract is derived from:

1. An initial state
2. A contract function
3. An ordered list of actions

In functional programming terms this is just a fold or reduce operation. In pseudo-code:

```javascript
initState = { ... }
contractFunction = (state, action) => state
actions = [ action, action, action, ...]

state = initState

foreach (action in actions) {
  state = contractFunction(state, action)
}

// state is now the latest contract state.
```

The ordering of actions, is determined, firstly, by when they are mined in the chain, and secondly, by `sha256(transactionId + blockHash)`. So, the full ordering is `[ block_height, sha256(transactionId + blockHash) ]`. In this way they inherit the same consensus properties and finality of the chain, and influencing the order of transactions in a particular block is at least as expensive as mining a block.

The following articles provide details on how Smartweave works: [Let’s BUIDL: SmartWeave contracts (1)](https://cedriking.medium.com/lets-buidl-smartweave-contracts-6353d22c4561) [Let’s BUIDL: SmartWeave contracts (2)](https://cedriking.medium.com/lets-buidl-smartweave-contracts-2-16c904a8692d)

## Hello World Contract

A simple contract that waits for any users to call "Hello" and "World". Once both have been called, it sets it's state to `happy: true`

Contract Source:

```javascript

export function handle(state, action) {
  
  if (action.input.function === 'Hello') {
    state.heardHello = true;
  }
  if (action.input.function === 'World') {
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

## Contract Format and Interface

Every contract has an initial state, and the contract source. These are written to the Arweave blockchain as data transactions. The initial state for a contract should be a Json object or array.

A Contract's source is written is ES module format. It exports exactly one function `handle` with the signature `ContractHandler` below:

```typescript

interface ContractInteraction {
  input: any
  caller: string
}

interface ContractHandlerResult {
  result?: any
  state?: any
}

type ContractHandler = (state: any, interaction: ContractInteraction) =>
  ContractHandlerResult | Promise<ContractHandlerResult>

```

The contract handler takes it's current state, and a ContractInteraction object as arguments. The ContractInteraction has two properties:

- `caller` the wallet address of the user interacting with the contract.
- `input` the user controlled input to the contract. This will always be a truthy Javascript value that has been passed through JSON.parse() but otherwise, it is a caller controlled value.
The input size is limited to ~2000 bytes (as it is being saved as "tags" - the total size of the names and values may not exceed 2048 bytes).

The handler function should terminate by one of:

- returning `{ state: newState }` when it's state has changed.
- returning `{ result: someResult }` when the interaction was a read only operation that did not change the contract state.
- throwing a `ContractError` exception, indicating the interaction could not be completed successfully.

If the contract throws a different type of exception, this will be caught and contract's state will not be updated. The *only time the contract's state will be updated* is when it successfully returns `{ state: state }`.

You can read some example contracts and their initial state files in the [examples](examples/) folder in this repo.

## Contract Writing Guidelines

Contract must be deterministic! As of SmartWeave v0.3 they run in a full Js environment, so can do a lot of things, but it's trivially easy to write a contract that forks due to non-deterministic operations, or environment differences. Some things you should never do inside a contract:

- Network calls
- Random number generation
- Any operation that would give different results depending on the environment
- Any operation that would give different results when run at different times.

In general the contract handler should be a [pure function](https://en.wikipedia.org/wiki/Pure_function) that always gives the same output for the same input.

In addition, you should be *very careful to sanitize the input object*, since it is user controlled you should be very strict and check it is the exact format you expect. See [examples/token.js](examples/token.js) where we check the input value `qty` is a number, is non-negative, and some other checks, and throw errors if any of them fail.

## SmartWeave Global API

Contracts have access to a global object `SmartWeave` that provides an additional API. This provides access to some utility functions, more information about current interaction, and an API to read another contracts state.

Note this API provide read access to values as they were at the *block height of the action being executed* 

It provides the following API to read information about the current transaction and block it is contained in:

```javascript
SmartWeave.transaction.id  
SmartWeave.transaction.owner
SmartWeave.transaction.target
SmartWeave.transaction.quantity
SmartWeave.transaction.reward
SmartWeave.transaction.tags
SmartWeave.block.height
SmartWeave.block.indep_hash
SmartWeave.block.timestamp
```

It provides access to some utility APIs from arweave-js:

```javascript
SmartWeave.arweave.crypto
SmartWeave.arweave.utils
SmartWeave.arweave.ar
SmartWeave.arweave.wallets
```

It provides a method to read another contracts state (this will read the state at the block height of the current interaction)

```typescript
SmartWeave.contracts.readContractState(contractId: string): Promise<any>
```

Finally, it also provides complete access to the full Arweave.js client under `SmartWeave.unsafeClient`. Use of this library in your smart contracts can easily introduce non-determinism, which could cause your contract to have inconsistent state between users. It does, however, have a number of legitimate and safe uses if deployed carefully. You have been warned!

See [examples/read-other-contract.js](examples/read-other-contract.js) for an example of reading another contracts state.

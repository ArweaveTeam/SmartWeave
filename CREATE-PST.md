# PST Guide

- [PST Guide](#pst-guide)
  - [Introduction](#introduction)
  - [Creating a new PST contract](#creating-a-new-pst-contract)
  - [Transferring tokens](#transferring-tokens)
  - [Viewing token balances](#viewing-token-balances)
  - [Using the SmartWeave SDK in your App](#using-the-smartweave-sdk-in-your-app)
  - [Distributing fees to PST holders](#distributing-fees-to-pst-holders)

## Introduction

PSTs (Profit Sharing Tokens) are made up of two parts:

1. The token: represents ownership shares in the app.
2. The app: during usage, distributes usage fees in AR to the token holders on a [pro-rata](https://en.wikipedia.org/wiki/Pro_rata) basis.

This guide will give an overview of how to create your PST token, and how to use the SmartWeave SDK in your app to distribute usage fees to the token holders.

To follow along, a non-empty Arweave wallet is required. You can obtain one at [faucet.arweave.net](https://faucet.arweave.net), for example.

You should also install the SmartWeave SDK. You can install it either globally — to have the CLI available everywhere — or locally — into your project folder:

```
npm install smartweave
```

## Creating a new PST contract

Using the SmartWeave CLI tool, we will leverage an already-deployed contract ([ff8wOKWGIS6xKlhA8U6t70ydZOozixF5jQMp4yjoTc8](https://arweave.net/ff8wOKWGIS6xKlhA8U6t70ydZOozixF5jQMp4yjoTc8)) to create your PST.

First, copy the example JSON found here: [examples/token-pst.json](examples/token-pst.json).

`cp examples/token-pst.json my-pst-token-state.json`

Then, edit the initial state. Ensure you update a) the ticker name, and b) the wallet address that controls the initial tokens.

Run the following command to deploy a new contract instance:

`npx smartweave create ff8wOKWGIS6xKlhA8U6t70ydZOozixF5jQMp4yjoTc8 my-pst-token-state.json --key-file /path/to/keyfile.json`

You will get back a Transaction ID: this is equivalent to your Contract ID. (Note: you no longer need the .json file that initialized the contract.) Once the transaction is mined (this may take a few minutes), check the state of your PST token with the following command:

`npx smartweave read CONTRACT_ID`

## Transferring tokens 

To transfer tokens to a target wallet, use the following command:

`npx smartweave write CONTRACT_ID --key-file /path/to/keyfile.json --input '{ "function": "transfer", "qty": 500, "target": "TARGETWALLET" }'`

## Viewing token balances

To view the balance of a particular address/wallet, use the following command:

`npx smartweave write CONTRACTID --input '{ "function": "balance", "target": "TARGETWALLET" }' --key-file /path/to/keyfile.json --dry-run`

## Using the SmartWeave SDK in your app

This section conveys the basics of using the Smartwweave SDK in a PST app (note: more complete SDK documentation can be found [here](SDK.md)).

An example of how to read the latest contract state:

```typescript

import { readContract } from 'smartweave'

const arweave = ... // This is a previously initialized arweave client.

// Replace this Id with the contract you want to read.
const contractId = 'X1Mx-u6XE_aC7_k0gFQbLlHhxMYIRhTItdHkS3hs36c'

readContract(arweave, contractId).then(contractState => {
  // contractState is the latest state of the contract.
  // assuming it's a PST token, dump all the balances to the console:
  console.log(contractState.balances)
})
```

## Distributing fees to PST holders

How and when exactly you choose to distribute fees to PST holders is up to you. Typically, distributions are made when a user writes a transaction to Arweave using your app (eg. upon sending a message or uploading a file intended for storage on Arweave), though there is more than one approach.

> Note: you must distribute fees on a pro-rata basis in accordance to PST holders' percentage-holding in the PST. The correct way to do this is not to split a given fee among all holders (requiring multiple transactions), but to select one specific holder probabilistically, based on the percentage of their holdings.

Included in the SmartWeave SDK is a ultility function, `selectWeightedPstHolder`, to select one token holder from a set of balances, based on their holdings. To send a fee to a PST holder:

```typescript

import { selectWeightedPstHolder } from 'smartweave'

const arweave = ... // an arweave client initialized previously.
const contractState = ... // the PST contract state loaded previously.
const jwk = ... // the users wallet loaded previously.

async function sendFee() {
  const holder = selectWeightedPstHolder(contractState.balances)
  // send a fee. You should inform the user about this fee and amount.
  const tx = await arweave.transactions.createTransaction({ target: holder, quantity: 0.1 }, jwk)
  await arweave.transactions.sign(tx, jwk)
  await arweave.transactions.post(tx)
}
```

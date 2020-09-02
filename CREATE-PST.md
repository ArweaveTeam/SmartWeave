# PST Guide

- [PST Guide](#pst-guide)
  - [Introduction](#introduction)
  - [Creating a new PST contract](#creating-a-new-pst-contract)
  - [Transferring tokens and viewing balances of your PST token](#transferring-tokens-and-viewing-balances-of-your-pst-token)
  - [Using the SmartWeave SDK in your App](#using-the-smartweave-sdk-in-your-app)
  - [Distributing fees to PST holders](#distributing-fees-to-pst-holders)

## Introduction

PSTs (Profit Sharing Tokens) are made up of two parts:

1. The token, that represents ownership shares in the app.
2. The app, that during usage, distributes usage-fees in AR to the token holders on a pro-rata basis.

This guide will give an overview of how to create your PST token, and how to use the SmartWeave SDK in the app to distribute usage fees to the token holders.

To follow this, you will need an Arweave wallet, funded with some AR. You can get one at [arweave.org/tokens](https://arweave.org/tokens), or generate one offline with the [arweave-deploy](https://github.com/ArweaveTeam/arweave-deploy#arweave-deploy) CLI tools.

You should also install the SmartWeave SDK. You can install it either globally (to have the cli available everywhere) or into your project folder:

```
npm install smartweave
```

Hosted on Arweave:
```
npm install https://arweave.net/I5tkm4L0e39IPmvZbShWf5eHmTvKbxo048t-iNKqLqE
```

## Creating a new PST contract

There is an existing contract source ([ff8wOKWGIS6xKlhA8U6t70ydZOozixF5jQMp4yjoTc8](https://arweave.net/ff8wOKWGIS6xKlhA8U6t70ydZOozixF5jQMp4yjoTc8)) already deployed that you should use, and you can create new instance of this contract for your PST using the SmartWeave CLI tool.

First, copy and edit the example init state Json from `examples/token-pst.json`

`cp examples/token.json my-pst-token.json`

Edit that file to change the a) ticker name, and importantly b) the wallet address that controls the initial tokens.

Run the following command to deploy a new contract instance:

`npx smartweave-cli --key-file /path/to/keyfile.json --create --contract-src-tx ff8wOKWGIS6xKlhA8U6t70ydZOozixF5jQMp4yjoTc8 --init-state my-pst-token.json`

You will get back a transaction id, this is your Contract ID, and you don't need to keep around the .json file that initialized it. Once the transaction is mined, (it may take a few minutes), you can check the state of your PST token with the following command:

`npx smartweave-cli --key-file /path/to/keyfile.json --contract CONTRACTID --get-state`

## Transferring tokens and viewing balances of your PST token

`npx smartweave-cli --key-file /path/to/keyfile.json --contract CONTRACTID --interact --input '{ "function": "transfer", "qty": 500, "target": "TARGETWALLET" }'`

To view the balance of a particular address/wallet, you can use the following command:

`npx smartweave-cli --key-file /path/to/keyfile.json --contract CONTRACTID --interact --input '{ "function": "balance", "target": "TARGETWALLET" }' --dry-run`

## Using the SmartWeave SDK in your App

More complete SDK documentation can be found [here](SDK.md), this section shows the basics of how you can use it in a PST app.

An example of how to read the latest contract state:

```typescript

import { readContract } from 'smartweave'

const arweave = ... // This is a previously initialized arweave client.

// Replace this Id with the contract you want to read.
const contractId = 'X1Mx-u6XE_aC7_k0gFQbLlHhxMYIRhTItdHkS3hs36c'

readContract(arweave, contractId).then(contractState => {
  // contractState is the latest state of the contract.
  // assuming its a PST token, dump all the balances to the console:
  console.log(contractState.balances)
})
```

## Distributing fees to PST holders

How and when exactly you distribute fees to the PST holders is up to you, it would typically be done when a user writes a transaction to your app, (for example, if they send a message or upload file that is stored on Arweave), but you could take some other approaches.

One model you should follow for it to be a PST, is that you must distribute the fees on a pro-rata basis according to the PST holders % holding in the PST. The correct way to do this not to split the fee among all the holders (and have to send many individual transactions), but to select one of the holders, probabilistically based on what percentage of the token they hold.

There is a utility function included in the SmartWeave SDK to select one token holder from a set of balances based on their holdings, so sending a fee to a PST holder looks like this:

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

# PST Creation Guide

To follow this, you will need an Arweave wallet, funded with some AR. You can get one at [arweave.org/tokens](https://arweave.org/tokens), or generate one offline with the [arweave-deploy](https://github.com/ArweaveTeam/arweave-deploy#arweave-deploy) CLI tools.

## Creating a new PST contract

There is an existing contract source ([ff8wOKWGIS6xKlhA8U6t70ydZOozixF5jQMp4yjoTc8](https://arweave.net/ff8wOKWGIS6xKlhA8U6t70ydZOozixF5jQMp4yjoTc8)) already deployed that you should use, and you can create new instance of this contract for your PST using the SmartWeave CLI tool.

First, copy and edit the example init state Json from `examples/token-pst.json`

`cp examples/token.json my-pst-token.json`

*Edit that file to change the a) ticker name, and importantly b) the wallet address that controls the initial tokens.*

Then simply run the following command to deploy a new contract instance:

`node smartweave-cli --key-file /path/to/keyfile.json --create --contract-src-tx Wa3kRcY8u9CMtoVaG4L0OTkHqZXw35uMU-qFG_k4jzI --init-state my-pst-token.json`

You will get back a transaction id, this is your Contract Id, and you don't need to keep around the .json file that initialized it. Once the transaction is mined, (it may take a few minutes), you can check the state of your PST token with the following command:

`node smartweave-cli --key-file /path/to/keyfile.json --contract CONTRACTID --get-state`

## Transferring tokens and viewing balances

To transfer tokens to another address you can use the following command:

`node smartweave-cli --key-file /path/to/keyfile.json --contract CONTRACTID --interact --input '{ "function": "transfer", "qty": 500, "target": "TARGETWALLET" }'`

To view the balance of a particular address/wallet, you can use the following command:

`node smartweave-cli --key-file /path/to/keyfile.json --contract CONTRACTID --interact --input '{ "function": "balance", "target": "TARGETWALLET" }' --dry-run`










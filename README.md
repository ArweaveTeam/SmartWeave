# SmartWeave

## Simple, scalable smart contracts on the Arweave protocol

Uses lazy-evaluation to move the burden of contract execution from network nodes
to smart contract users. Currently, SmartWeave supports JavaScript, using the
client's unmodified execution engine.

**Version: 0.3**

For information on how the contracts execute, how to write one, and the API, read the [Contract Guide](CONTRACT-GUIDE.md) and check some of the [examples](examples/)

## CLI Usage

Clone this repository and run `npm install`.

You can deploy a contract as follows:

```
node smartweave-cli --key-file [YOUR KEYFILE] \
  --create --contract-src [SRC LOCATION] \
  --init-state [INITIAL STATE FILE]
```

Check its state:

```
node smartweave-cli --key-file [YOUR KEYFILE] \
  --contract [CONTRACT TXID] \
  --get-state
```

Interact with it:

```
node smartweave-cli --key-file [YOUR KEYFILE] \
  --contract [CONTRACT TXID] \
  --interact \
  --input "[CONTRACT INPUT STRING HERE]"
```

When interacting with the contract, the value passed to --input must be valid json. Typically an object is used:

`--input '{ "function": "transfer", "qty": 1984 }'`

To test a contract interaction without writing it to the network, append `--dry-run` to your `--interact` call.

## License

This project is licensed under the terms of the MIT license.

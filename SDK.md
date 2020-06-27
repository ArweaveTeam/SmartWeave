# SmartWeave SDK

- [SmartWeave SDK](#smartweave-sdk)
  - [SDK Methods](#sdk-methods)
    - [`createContract`](#createcontract)
    - [`createContractFromTx`](#createcontractfromtx)
    - [`interactWrite`](#interactwrite)
    - [`interactWriteDryRun`](#interactwritedryrun)
    - [`interactRead`](#interactread)
    - [`readContract`](#readcontract)
    - [`selectWeightedPstHolder`](#selectweightedpstholder)

The SmartWeave SDK can be installed from Arweave:

`npm install https://arweave.net/AM-u4X2po-3Tx7fma3lRonCfLwrjI42IALwDL_YFXBs`

You can import the full API or individual methods.

```typescript
import * as SmartWeaveSdk from 'smartweave'
```

```typescript
import { readContract, interactWrite, createContract } from 'smartweave'
```

## SDK Methods

### `createContract`

```typescript
async function createContract(arweave: Arweave, wallet: JWKInterface, contractSrc: string, initState: string, minFee?: number): Promise<string>
```

Create a new contract from a contract source file and an initial state.
Returns the contract id.
  
- `arweave`       an Arweave client instance
- `wallet`        a wallet private or public key
- `contractSrc`   the contract source code as string.  
- `initState`     the contract initial state, as a JSON string.

### `createContractFromTx`

 ```typescript
async function createContractFromTx(arweave: Arweave, wallet: JWKInterface, srcTxId: string, state: string, minFee?: number): Promise<string>
```

Create a new contract from an existing contract source tx, with an initial state. Returns the contract id.

- `arweave`   an Arweave client instance
- `wallet`    a wallet private or public key
- `srcTxId`   the contract source Tx id.
- `state`     the initial state, as a JSON string.  

### `interactWrite`

```typescript
async function interactWrite(arweave: Arweave, wallet: JWKInterface, contractId: string, input: any): Promise<string>
```

Writes an interaction on the blockchain. This creates an interaction tx and posts it, it does not need to know the current state of the contract.

- `arweave`       an Arweave client instance
- `wallet`        a wallet private key
- `contractId`    the Transaction Id of the contract
- `input`         the interaction input, will be serialized as Json.

### `interactWriteDryRun`

```typescript
async function interactWriteDryRun(arweave: Arweave, wallet: JWKInterface, contractId: string, input: any): Promise<ContractInteractionResult>
```

This will load a contract to its latest state, and do a dry run of an interaction, without writing anything to the chain, simulating a write.

- `arweave`       an Arweave client instance
- `wallet`        a wallet private or public key
- `contractId`    the Transaction Id of the contract
- `input`         the interaction input.

### `interactRead`

```typescript
async function interactRead(arweave: Arweave, wallet: JWKInterface, contractId: string, input: any): Promise<any>
```

Load a contract to its latest state, and execute a read interaction that does not change any state.

- `arweave`       an Arweave client instance
- `wallet`        a wallet private or public key
- `contractId`    the Transaction Id of the contract
- `input`         the interaction input.

### `readContract`

```typescript
async function readContract(arweave: Arweave, contractId: string, height?: number): Promise<any>
```

Queries all interaction transactions and replays a contract to its latest state. If height is provided, will replay only to that block height.

- `arweave`     an Arweave client instance
- `contractId`  the Transaction Id of the contract
- `height`      if specified the contract will be replayed only to this block height

### `selectWeightedPstHolder`

```typescript
function selectWeightedPstHolder(balances: Record<string, number>): string
```

A utility function for PST tokens. Given an map of address->balance, select one random address weighted by the amount of tokens they hold.

- `balances`  A balances object

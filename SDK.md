# SmartWeave SDK

The SmartWeave SDK can be installed from Arweave:

`npm install https://arweave.net/dV7c-Qf_PDk5In5BXzw1y9i4AWUrXr-wvvikZzDe7ZM`

You can import the full API or individual methods.

```typescript
import * as SmartWeaveSdk from 'smartweave'
```

```typescript
import { readContract, interactWrite, createContract } from 'smartweave'
```

The full list of methods available in the SDK is as follows.

`createContract`

Creates a new contract from source code and initial state. Returns a Contract ID.

`createContractFromTx`

Creates a new contract from an existing contract source transaction, but new initial state. This gives a new instance of the contract, while sharing the source code with other contracts of the same type. Returns a Contract ID.

`interactWrite`

Writes a new interaction to a contract. Returns the Interaction ID.

`interactWriteDryRun`

Simulates writing a new interaction to a contract, without actually writing anything. Returns the simulated contract state.

`interactRead`

Executes a read operation on a contract, that is an interaction that does not change the contracts state but only returns a value. Returns the result of the read operation.

`readContract`

Reads the contracts complete latest state. This reads the contracts latest confirmed state. Returns the contracts state, which will be a JavaScript object.

`selectWeightedPstHolder`

A utility function for PST tokens, to select a single holder weighted by their percentage holding in the token.

`loadContract`

Loads the contract source, initial state, and some additional information. Generally you won't need to use this as it is used internally by other methods.

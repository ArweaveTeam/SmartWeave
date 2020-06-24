import Arweave from "arweave/node";
import { InteractionTx } from "./interaction-tx";
import { unpackTags } from "./utils";
import { replayToState } from "./contract-replay";

/**
 * 
 * This class is be exposed as a global for contracts 
 * as 'SmartWeave' and provides an API for getting further
 * information or using utility and crypto functions from
 * inside the contracts execution.
 * 
 * It provides an api:
 *
 * - SmartWeave.transaction.id 
 * - SmartWeave.transaction.reward 
 * - SmartWeave.block.height 
 * - etc 
 * 
 * and access to some of the arweave utils: 
 * - SmartWeave.arweave.utils 
 * - SmartWeave.arweave.crypto
 * - SmartWeave.arweave.wallets
 * - SmartWeave.arweave.ar
 * 
 */
export class SmartWeaveGlobal {

  transaction: Transaction
  block: Block 
  
  arweave: Pick<Arweave, 'ar' | 'wallets' | 'utils' | 'crypto'>

  contracts: {
    readContractState(contractId: string): Promise<any>
  }

  _activeTx?: InteractionTx

  constructor(arweave: Arweave) {
    this.arweave = {
      ar: arweave.ar,
      utils: arweave.utils,
      wallets: arweave.wallets,
      crypto: arweave.crypto,
    }
    this.transaction = new Transaction(this);
    this.block = new Block(this);
    this.contracts = {
      readContractState: (contractId: string, height?: number) => replayToState(arweave, contractId, height || this.block.height)
    }
  }
}

class Transaction {

  constructor(private global: SmartWeaveGlobal) {
  }

  get id() {
    if (!this.global._activeTx) {
      throw new Error('No current Tx');
    }
    return this.global._activeTx.id
  }

  get owner() {
    if (!this.global._activeTx) {
      throw new Error('No current Tx');
    }
    return this.global._activeTx.tx.owner
  }

  get target() {
    if (!this.global._activeTx) {
      throw new Error('No current Tx');
    }
    return this.global._activeTx.tx.target
  }

  get tags() {
    if (!this.global._activeTx) {
      throw new Error('No current Tx');
    }
    return unpackTags(this.global._activeTx.tx)
  }

  get quantity() {
    if (!this.global._activeTx) {
      throw new Error('No current Tx');
    }
    return this.global._activeTx.tx.quantity
  }

  get reward() {
    if (!this.global._activeTx) {
      throw new Error('No current Tx');
    }
    return this.global._activeTx.tx.reward
  }

}

class Block {

  constructor(private global: SmartWeaveGlobal) {
  }

  get height() {
    if (!this.global._activeTx) {
      throw new Error('No current Tx');
    }
    return this.global._activeTx.info.confirmed!.block_height
  }
  get indep_hash() {
    if (!this.global._activeTx) {
      throw new Error('No current Tx');
    }
    return this.global._activeTx.info.confirmed!.block_indep_hash 
  }
}




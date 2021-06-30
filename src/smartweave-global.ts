import Arweave from 'arweave';
import { InteractionTx } from './interaction-tx';
import { readContract } from './contract-read';

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
 * as well as access to the potentially non-deterministic full client:
 * - SmartWeave.unsafeClient
 *
 */
export class SmartWeaveGlobal {
  transaction: Transaction;
  block: Block;
  arweave: Pick<Arweave, 'ar' | 'wallets' | 'utils' | 'crypto'>;
  contract: {
    id: string;
    owner: string;
  };
  unsafeClient: Arweave;

  contracts: {
    readContractState: (contractId: string) => Promise<any>;
  };

  _activeTx?: InteractionTx;

  get _isDryRunning() {
    return !this._activeTx;
  }

  constructor(
    arweave: Arweave,
    contract: {
      id: string;
      owner: string;
      customReadContract: (arweave: Arweave, contractId: string, height?: number, returnValidity?: boolean) => any;
    },
  ) {
    this.unsafeClient = arweave;
    this.arweave = {
      ar: arweave.ar,
      utils: arweave.utils,
      wallets: arweave.wallets,
      crypto: arweave.crypto,
    };
    this.contract = contract;
    this.transaction = new Transaction(this);
    this.block = new Block(this);

    const readContractFn = contract.customReadContract || readContract;

    this.contracts = {
      readContractState: (contractId: string, height?: number, returnValidity?: boolean) =>
        readContractFn(
          arweave,
          contractId,
          height || (this._isDryRunning ? Number.POSITIVE_INFINITY : this.block.height),
          returnValidity,
        ),
    };
  }
}

// tslint:disable-next-line: max-classes-per-file
class Transaction {
  constructor(private readonly global: SmartWeaveGlobal) {}

  get id() {
    if (!this.global._activeTx) {
      throw new Error('No current Tx');
    }
    return this.global._activeTx.id;
  }

  get owner() {
    if (!this.global._activeTx) {
      throw new Error('No current Tx');
    }
    return this.global._activeTx.owner.address;
  }

  get target() {
    if (!this.global._activeTx) {
      throw new Error('No current Tx');
    }
    return this.global._activeTx.recipient;
  }

  get tags() {
    if (!this.global._activeTx) {
      throw new Error('No current Tx');
    }
    return this.global._activeTx.tags;
  }

  get quantity() {
    if (!this.global._activeTx) {
      throw new Error('No current Tx');
    }
    return this.global._activeTx.quantity.winston;
  }

  get reward() {
    if (!this.global._activeTx) {
      throw new Error('No current Tx');
    }
    return this.global._activeTx.fee.winston;
  }
}

// tslint:disable-next-line: max-classes-per-file
class Block {
  constructor(private readonly global: SmartWeaveGlobal) {}

  get height() {
    if (!this.global._activeTx) {
      throw new Error('No current Tx');
    }
    return this.global._activeTx.block.height;
  }

  get indep_hash() {
    if (!this.global._activeTx) {
      throw new Error('No current Tx');
    }
    return this.global._activeTx.block.id;
  }

  get timestamp() {
    if (!this.global._activeTx) {
      throw new Error('No current tx');
    }
    return this.global._activeTx.block.timestamp;
  }
}

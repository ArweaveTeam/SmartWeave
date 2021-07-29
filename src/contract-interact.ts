import Arweave from 'arweave';
import { CreateTransactionInterface } from 'arweave/node/common';
import Transaction from 'arweave/node/lib/transaction';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { loadContract } from './contract-load';
import { readContract } from './contract-read';
import { execute, ContractInteraction, ContractInteractionResult, ContractHandler } from './contract-step';
import { unpackTags } from './utils';
import { BlockData } from 'arweave/node/blocks';
import SmartWeaveError, { SmartWeaveErrorType } from './errors';
import { SmartWeaveGlobal } from './smartweave-global';

/**
 * Writes an interaction on the blockchain.
 *
 * This simply creates an interaction tx and posts it.
 * It does not need to know the current state of the contract.
 *
 * @param arweave       an Arweave client instance
 * @param wallet        a wallet private key
 * @param contractId    the Transaction Id of the contract
 * @param input         the interaction input, will be serialized as Json.
 * @param tags          an array of tags with name/value as objects.
 * @param target        if needed to send AR to an address, this is the target.
 * @param winstonQty    amount of winston to send to the target, if needed.
 */
export async function interactWrite(
  arweave: Arweave,
  wallet: JWKInterface | 'use_wallet',
  contractId: string,
  input: any,
  tags: { name: string; value: string }[] = [],
  target: string = '',
  winstonQty: string = '',
): Promise<string> {
  const interactionTx = await createTx(arweave, wallet, contractId, input, tags, target, winstonQty);

  const response = await arweave.transactions.post(interactionTx);

  if (response.status !== 200) return null;

  return interactionTx.id;
}

/**
 * Simulates an interaction on the blockchain and returns the simulated transaction.
 *
 * This simply creates an interaction tx and posts it.
 * It does not need to know the current state of the contract.
 *
 * @param arweave       an Arweave client instance
 * @param wallet        a wallet private key
 * @param contractId    the Transaction Id of the contract
 * @param input         the interaction input, will be serialized as Json.
 * @param tags          an array of tags with name/value as objects.
 * @param target        if needed to send AR to an address, this is the target.
 * @param winstonQty    amount of winston to send to the target, if needed.
 */
export async function simulateInteractWrite(
  arweave: Arweave,
  wallet: JWKInterface,
  contractId: string,
  input: any,
  tags: { name: string; value: string }[] = [],
  target: string = '',
  winstonQty: string = '',
): Promise<Transaction> {
  const interactionTx = await createTx(arweave, wallet, contractId, input, tags, target, winstonQty);
  return interactionTx;
}

/**
 * This will load a contract to its latest state, and do a dry run of an interaction,
 * without writing anything to the chain.
 *
 * @param arweave       an Arweave client instance
 * @param wallet        a wallet private or public key
 * @param contractId    the Transaction Id of the contract
 * @param input         the interaction input.
 * @param tags          an array of tags with name/value as objects.
 * @param target        if needed to send AR to an address, this is the target.
 * @param winstonQty    amount of winston to send to the target, if needed.
 * @param myState       a locally-generated state variable
 * @param fromParam     The from address of the transaction
 * @param contractInfoParam The loaded contract
 */
export async function interactWriteDryRun(
  arweave: Arweave,
  wallet: JWKInterface | 'use_wallet',
  contractId: string,
  input: any,
  tags: { name: string; value: string }[] = [],
  target: string = '',
  winstonQty: string = '',
  myState?: any,
  fromParam?: any,
  contractInfoParam?: {
    id: string;
    contractSrc: string;
    contractSrcTXID: string;
    initState: string;
    minFee: any;
    contractTX: Transaction;
    handler: ContractHandler;
    swGlobal: SmartWeaveGlobal;
  },
): Promise<ContractInteractionResult> {
  // tslint:disable-next-line: prefer-const
  let { handler, swGlobal, contractSrcTXID } = contractInfoParam || (await loadContract(arweave, contractId));
  const latestState = myState || (await readContract(arweave, contractId));
  const from = fromParam || (await arweave.wallets.getAddress(wallet));

  const settings = latestState.settings ? new Map(latestState.settings) : new Map();
  const evolve: string = latestState.evolve || settings.get('evolve');
  let canEvolve: boolean = latestState.canEvolve || settings.get('canEvolve');

  // By default, contracts can evolve if there's not an explicit `false`.
  if (canEvolve === undefined || canEvolve === null) {
    canEvolve = true;
  }

  if (evolve && /[a-z0-9_-]{43}/i.test(evolve) && canEvolve) {
    if (contractSrcTXID !== evolve) {
      try {
        const contractInfo = await loadContract(arweave, contractId, evolve);
        handler = contractInfo.handler;
      } catch (e) {
        const error: SmartWeaveError = new SmartWeaveError(SmartWeaveErrorType.CONTRACT_NOT_FOUND, {
          message: `Contract having txId: ${contractId} not found`,
          requestedTxId: contractId,
        });
        throw error;
      }
    }
  }

  const interaction: ContractInteraction = {
    input,
    caller: from,
  };

  const tx = await createTx(arweave, wallet, contractId, input, tags, target, winstonQty);

  const ts = unpackTags(tx);

  const currentBlock: BlockData = await arweave.blocks.getCurrent();

  swGlobal._activeTx = createDummyTx(tx, from, ts, currentBlock);

  return await execute(handler, interaction, latestState);
}

/**
 * This will load a contract to its latest state, and do a dry run of an interaction,
 * without writing anything to the chain.
 *
 * @param arweave       an Arweave client instance
 * @param tx            a signed transaction
 * @param contractId    the Transaction Id of the contract
 * @param input         the interaction input.
 * @param myState       a locally-generated state variable
 * @param fromParam     The from address of the transaction
 * @param contractInfoParam The loaded contract
 */
export async function interactWriteDryRunCustom(
  arweave: Arweave,
  tx: any,
  contractId: string,
  input: any,
  myState: any,
  fromParam: any = {},
  contractInfoParam: any,
): Promise<ContractInteractionResult> {
  // tslint:disable-next-line: prefer-const
  let { handler, swGlobal, contractSrcTXID } = contractInfoParam || (await loadContract(arweave, contractId));
  const latestState = myState || (await readContract(arweave, contractId));
  const from = fromParam;

  const settings = latestState.settings ? new Map(latestState.settings) : new Map();
  const evolve: string = latestState.evolve || settings.get('evolve');
  let canEvolve: boolean = latestState.canEvolve || settings.get('canEvolve');

  // By default, contracts can evolve if there's not an explicit `false`.
  if (canEvolve === undefined || canEvolve === null) {
    canEvolve = true;
  }

  if (evolve && /[a-z0-9_-]{43}/i.test(evolve) && canEvolve) {
    if (contractSrcTXID !== evolve) {
      try {
        const contractInfo = await loadContract(arweave, contractId, evolve);
        handler = contractInfo.handler;
      } catch (e) {
        const error: SmartWeaveError = new SmartWeaveError(SmartWeaveErrorType.CONTRACT_NOT_FOUND, {
          message: `Contract having txId: ${contractId} not found`,
          requestedTxId: contractId,
        });
        throw error;
      }
    }
  }

  const interaction: ContractInteraction = {
    input,
    caller: from,
  };

  const ts = unpackTags(tx);

  const currentBlock: BlockData = await arweave.blocks.getCurrent();

  swGlobal._activeTx = createDummyTx(tx, from, ts, currentBlock);

  return await execute(handler, interaction, latestState);
}

/**
 * This will load a contract to its latest state, and execute a read interaction that
 * does not change any state.
 *
 * @param arweave       an Arweave client instance
 * @param wallet        a wallet private or public key
 * @param contractId    the Transaction Id of the contract
 * @param input         the interaction input.
 * @param tags          an array of tags with name/value as objects.
 * @param target        if needed to send AR to an address, this is the target.
 * @param winstonQty    amount of winston to send to the target, if needed.
 */
export async function interactRead(
  arweave: Arweave,
  wallet: JWKInterface | 'use_wallet' | undefined,
  contractId: string,
  input: any,
  tags: { name: string; value: string }[] = [],
  target: string = '',
  winstonQty: string = '',
): Promise<any> {
  // tslint:disable-next-line: prefer-const
  let { handler, swGlobal, contractSrcTXID } = await loadContract(arweave, contractId);
  const latestState = await readContract(arweave, contractId);
  const from = wallet ? await arweave.wallets.getAddress(wallet) : '';

  const settings = latestState.settings ? new Map(latestState.settings) : new Map();
  const evolve: string = latestState.evolve || settings.get('evolve');
  let canEvolve: boolean = latestState.canEvolve || settings.get('canEvolve');

  // By default, contracts can evolve if there's not an explicit `false`.
  if (canEvolve === undefined || canEvolve === null) {
    canEvolve = true;
  }

  if (evolve && /[a-z0-9_-]{43}/i.test(evolve) && canEvolve) {
    if (contractSrcTXID !== evolve) {
      try {
        const contractInfo = await loadContract(arweave, contractId, evolve);
        handler = contractInfo.handler;
      } catch (e) {
        const error: SmartWeaveError = new SmartWeaveError(SmartWeaveErrorType.CONTRACT_NOT_FOUND, {
          message: `Contract having txId: ${contractId} not found`,
          requestedTxId: contractId,
        });
        throw error;
      }
    }
  }

  const interaction: ContractInteraction = {
    input,
    caller: from,
  };

  const tx = await createTx(arweave, wallet, contractId, input, tags, target, winstonQty);
  const ts = unpackTags(tx);
  const currentBlock: BlockData = await arweave.blocks.getCurrent();

  swGlobal._activeTx = createDummyTx(tx, from, ts, currentBlock);

  const result = await execute(handler, interaction, latestState);

  return result.result;
}

async function createTx(
  arweave: Arweave,
  wallet: JWKInterface | 'use_wallet',
  contractId: string,
  input: any,
  tags: { name: string; value: string }[],
  target: string = '',
  winstonQty: string = '0',
): Promise<Transaction> {
  const options: Partial<CreateTransactionInterface> = {
    data: Math.random().toString().slice(-4),
  };

  if (target && target.length) {
    options.target = target.toString();
    if (winstonQty && +winstonQty > 0) {
      options.quantity = winstonQty.toString();
    }
  }

  const interactionTx = await arweave.createTransaction(options, wallet);

  if (!input) {
    throw new Error(`Input should be a truthy value: ${JSON.stringify(input)}`);
  }

  if (tags && tags.length) {
    for (const tag of tags) {
      interactionTx.addTag(tag.name.toString(), tag.value.toString());
    }
  }
  interactionTx.addTag('App-Name', 'SmartWeaveAction');
  interactionTx.addTag('App-Version', '0.3.0');
  interactionTx.addTag('Contract', contractId);
  interactionTx.addTag('Input', JSON.stringify(input));

  await arweave.transactions.sign(interactionTx, wallet);
  return interactionTx;
}

function createDummyTx(tx: Transaction, from: string, tags: Record<string, string | string[]>, block: BlockData) {
  return {
    id: tx.id,
    owner: {
      address: from,
    },
    recipient: tx.target,
    tags,
    fee: {
      winston: tx.reward,
    },
    quantity: {
      winston: tx.quantity,
    },
    block: {
      id: block.indep_hash,
      height: block.height,
      timestamp: block.timestamp,
    },
  };
}

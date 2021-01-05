import Arweave from 'arweave';
import Transaction from 'arweave/node/lib/transaction';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { loadContract } from './contract-load';
import { readContract } from './contract-read';
import { execute, ContractInteraction, ContractInteractionResult } from './contract-step';
import { InteractionTx } from './interaction-tx';
import { unpackTags } from './utils';

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
  wallet: JWKInterface,
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
 */
export async function interactWriteDryRun(
  arweave: Arweave,
  wallet: JWKInterface,
  contractId: string,
  input: any,
  tags: { name: string; value: string }[] = [],
  target: string = '',
  winstonQty: string = '',
): Promise<ContractInteractionResult> {
  const contractInfo = await loadContract(arweave, contractId);
  const latestState = await readContract(arweave, contractId);
  const from = await arweave.wallets.jwkToAddress(wallet);

  const interaction: ContractInteraction = {
    input,
    caller: from,
  };

  const { height, current } = await arweave.network.getInfo();

  const tx = await createTx(arweave, wallet, contractId, input, tags, target, winstonQty);

  const ts = unpackTags(tx);

  const dummyActiveTx: InteractionTx = {
    id: tx.id,
    owner: {
      address: from,
    },
    recipient: tx.target,
    tags: ts,
    fee: {
      winston: tx.reward,
    },
    quantity: {
      winston: tx.quantity,
    },
    block: {
      height,
      id: current,
    },
  };

  contractInfo.swGlobal._activeTx = dummyActiveTx;

  return await execute(contractInfo.handler, interaction, latestState);
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
  wallet: JWKInterface | undefined,
  contractId: string,
  input: any,
  tags: { name: string; value: string }[] = [],
  target: string = '',
  winstonQty: string = '',
): Promise<any> {
  const contractInfo = await loadContract(arweave, contractId);
  const latestState = await readContract(arweave, contractId);
  const from = wallet ? await arweave.wallets.jwkToAddress(wallet) : '';

  const interaction: ContractInteraction = {
    input,
    caller: from,
  };

  const { height, current } = await arweave.network.getInfo();

  const tx = await createTx(arweave, wallet, contractId, input, tags, target, winstonQty);

  const ts = unpackTags(tx);

  const dummyActiveTx: InteractionTx = {
    id: tx.id,
    owner: {
      address: from,
    },
    recipient: tx.target,
    tags: ts,
    fee: {
      winston: tx.reward,
    },
    quantity: {
      winston: tx.quantity,
    },
    block: {
      height,
      id: current,
    },
  };

  contractInfo.swGlobal._activeTx = dummyActiveTx;

  const result = await execute(contractInfo.handler, interaction, latestState);
  return result.result;
}

async function createTx(
  arweave: Arweave,
  wallet: JWKInterface,
  contractId: string,
  input: any,
  tags: { name: string; value: string }[],
  target: string = '',
  winstonQty: string = '0',
): Promise<Transaction> {
  const txData = {
    data: Math.random().toString().slice(-4),
    target: '',
    quantity: '',
  };
  if (target && winstonQty && target.length && +winstonQty > 0) {
    txData.target = target;
    txData.quantity = winstonQty;
  }

  const interactionTx = await arweave.createTransaction(txData, wallet);

  if (!input) {
    throw new Error(`Input should be a truthy value: ${JSON.stringify(input)}`);
  }

  if (tags && tags.length) {
    for (const tag of tags) {
      interactionTx.addTag(tag.name, tag.value);
    }
  }
  interactionTx.addTag('App-Name', 'SmartWeaveAction');
  interactionTx.addTag('App-Version', '0.3.0');
  interactionTx.addTag('Contract', contractId);
  interactionTx.addTag('Input', JSON.stringify(input));

  await arweave.transactions.sign(interactionTx, wallet);
  return interactionTx;
}

import Arweave from 'arweave';
import Transaction from 'arweave/node/lib/transaction';
import { JWKInterface } from 'arweave/node/lib/wallet';

/**
 * Simulates the creation of a new contract from a contract, so that the cost for the creation can be checked
 * Returns the transaction describing the creation simulation.
 *
 * @param arweave       an Arweave client instance
 * @param wallet        a wallet private or public key
 * @param initState     the contract initial state, as a JSON string.
 * @param contractSrc optional the contract source as string.
 */
export async function simulateCreateContractFromSource(
  arweave: Arweave,
  wallet: JWKInterface | 'use_wallet',
  initState: string,
  contractSrc: string,
  reward?: string,
): Promise<Transaction> {
  const srcTx = await arweave.createTransaction({ data: contractSrc, reward }, wallet);

  srcTx.addTag('App-Name', 'SmartWeaveContractSource');
  srcTx.addTag('App-Version', '0.3.0');
  srcTx.addTag('Content-Type', 'application/javascript');

  await arweave.transactions.sign(srcTx, wallet);
  // compute the fee needed to deploy the init state
  const deployInitStateTx = await simulateCreateContractFromTx(arweave, wallet, srcTx.id, initState);
  const initStateReward = deployInitStateTx.reward;

  // update the reward of the contract creation by adding the reward needed for the creation of the state
  srcTx.reward = (parseFloat(srcTx.reward) + parseFloat(initStateReward)).toString();
  return srcTx;
}

/**
 * Simulate the creation of a contract from an existing contract source tx, with an initial state.
 * Returns the contract id.
 *
 * @param arweave   an Arweave client instance
 * @param wallet    a wallet private or public key
 * @param srcTxId   the contract source Tx id.
 * @param state     the initial state, as a JSON string.
 * @param tags          an array of tags with name/value as objects.
 * @param target        if needed to send AR to an address, this is the target.
 * @param winstonQty    amount of winston to send to the target, if needed.
 */
export async function simulateCreateContractFromTx(
  arweave: Arweave,
  wallet: JWKInterface | 'use_wallet',
  srcTxId: string,
  state: string,
  tags: { name: string; value: string }[] = [],
  target: string = '',
  winstonQty: string = '',
  reward?: string,
): Promise<Transaction> {
  let contractTX = await arweave.createTransaction({ data: state, reward }, wallet);

  if (target && winstonQty && target.length && +winstonQty > 0) {
    contractTX = await arweave.createTransaction(
      {
        data: state,
        target: target.toString(),
        quantity: winstonQty.toString(),
        reward,
      },
      wallet,
    );
  }

  if (tags && tags.length) {
    for (const tag of tags) {
      contractTX.addTag(tag.name.toString(), tag.value.toString());
    }
  }
  contractTX.addTag('App-Name', 'SmartWeaveContract');
  contractTX.addTag('App-Version', '0.3.0');
  contractTX.addTag('Contract-Src', srcTxId);
  contractTX.addTag('Content-Type', 'application/json');

  await arweave.transactions.sign(contractTX, wallet);
  return contractTX;
}

/**
 * Create a new contract from a contract source file and an initial state.
 * Returns the contract id.
 *
 * @param arweave       an Arweave client instance
 * @param wallet        a wallet private or public key
 * @param contractSrc   the contract source as string.
 * @param initState     the contract initial state, as a JSON string.
 */
export async function createContract(
  arweave: Arweave,
  wallet: JWKInterface | 'use_wallet',
  contractSrc: string,
  initState: string,
  reward?: string,
): Promise<string> {
  const srcTx = await arweave.createTransaction({ data: contractSrc, reward }, wallet);

  srcTx.addTag('App-Name', 'SmartWeaveContractSource');
  srcTx.addTag('App-Version', '0.3.0');
  srcTx.addTag('Content-Type', 'application/javascript');

  await arweave.transactions.sign(srcTx, wallet);

  const response = await arweave.transactions.post(srcTx);

  if (response.status === 200 || response.status === 208) {
    return await createContractFromTx(arweave, wallet, srcTx.id, initState);
  } else {
    throw new Error('Unable to write Contract Source.');
  }
}
/**
 * Create a new contract from an existing contract source tx, with an initial state.
 * Returns the contract id.
 *
 * @param arweave   an Arweave client instance
 * @param wallet    a wallet private or public key
 * @param srcTxId   the contract source Tx id.
 * @param state     the initial state, as a JSON string.
 * @param tags          an array of tags with name/value as objects.
 * @param target        if needed to send AR to an address, this is the target.
 * @param winstonQty    amount of winston to send to the target, if needed.
 */
export async function createContractFromTx(
  arweave: Arweave,
  wallet: JWKInterface | 'use_wallet',
  srcTxId: string,
  state: string,
  tags: { name: string; value: string }[] = [],
  target: string = '',
  winstonQty: string = '',
  reward?: string,
) {
  let contractTX = await arweave.createTransaction({ data: state, reward }, wallet);

  if (target && winstonQty && target.length && +winstonQty > 0) {
    contractTX = await arweave.createTransaction(
      {
        data: state,
        target: target.toString(),
        quantity: winstonQty.toString(),
        reward,
      },
      wallet,
    );
  }

  if (tags && tags.length) {
    for (const tag of tags) {
      contractTX.addTag(tag.name.toString(), tag.value.toString());
    }
  }
  contractTX.addTag('App-Name', 'SmartWeaveContract');
  contractTX.addTag('App-Version', '0.3.0');
  contractTX.addTag('Contract-Src', srcTxId);
  contractTX.addTag('Content-Type', 'application/json');

  await arweave.transactions.sign(contractTX, wallet);

  const response = await arweave.transactions.post(contractTX);
  if (response.status === 200 || response.status === 208) {
    return contractTX.id;
  } else {
    throw new Error('Unable to write Contract Initial State');
  }
}

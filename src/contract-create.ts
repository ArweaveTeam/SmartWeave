import Arweave from 'arweave';
import { JWKInterface } from 'arweave/node/lib/wallet';

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
  wallet: JWKInterface,
  contractSrc: string,
  initState: string,
): Promise<string> {
  const srcTx = await arweave.createTransaction({ data: contractSrc }, wallet);

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
 * Create a new conntract from an existing contract source tx, with an initial state.
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
  wallet: JWKInterface,
  srcTxId: string,
  state: string,
  tags: { name: string; value: string }[] = [],
  target: string = '',
  winstonQty: string = '',
) {
  const txData = {
    data: state,
    target: '',
    quantity: '',
  };
  if (target && winstonQty && target.length && +winstonQty > 0) {
    txData.target = target;
    txData.quantity = winstonQty;
  }

  // Create a contract from a stored source TXID, setting the default state.
  const contractTX = await arweave.createTransaction(txData, wallet);

  if (tags && tags.length) {
    for (const tag of tags) {
      contractTX.addTag(tag.name, tag.value);
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

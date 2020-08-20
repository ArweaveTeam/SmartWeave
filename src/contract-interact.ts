import Arweave from 'arweave/node';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { loadContract } from './contract-load';
import { readContract } from './contract-read';
import { execute, ContractInteraction } from './contract-step';
import { InteractionTx } from './interaction-tx';

/**
 * zeros as b64url
 */
const NO_BLOCK_HASH = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

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
 */
export async function interactWrite(arweave: Arweave, wallet: JWKInterface, contractId: string, input: any) {
  
  const interactionTx = await createTx(arweave, wallet, contractId, input);
  
  const response = await arweave.transactions.post(interactionTx);

  if (response.status != 200) return false;

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
 */
export async function interactWriteDryRun(arweave: Arweave, wallet: JWKInterface, contractId: string, input: any) {
  const contractInfo = await loadContract(arweave, contractId);
  const latestState = await readContract(arweave, contractId);
  const from = await arweave.wallets.jwkToAddress(wallet);
  
  const interaction: ContractInteraction = {
    input: input,
    caller: from
  };

  const { height } = await arweave.network.getInfo();

  const tx = await createTx(arweave, wallet, contractId, input);
 
  const dummyActiveTx: InteractionTx = {
    info: {
      status: 200,
      confirmed: {
        block_height: height + 1,
        block_indep_hash: NO_BLOCK_HASH,
        number_of_confirmations: 0,
      }
    },
    id: tx.id,
    tx: tx,
    sortKey: '',
    from: from,
  }

  contractInfo.swGlobal._activeTx = dummyActiveTx;

  return execute(contractInfo.handler, interaction, latestState);
}


/**
 * This will load a contract to its latest state, and execute a read interaction that
 * does not change any state.
 *
 * @param arweave       an Arweave client instance
 * @param wallet        a wallet private or public key
 * @param contractId    the Transaction Id of the contract
 * @param input         the interaction input.
 */
export async function interactRead(arweave: Arweave, wallet: JWKInterface, contractId: string, input: any) {
  const contractInfo = await loadContract(arweave, contractId);
  const latestState = await readContract(arweave, contractId);
  const from = await arweave.wallets.jwkToAddress(wallet);

  const interaction: ContractInteraction = {
    input: input,
    caller: from
  };

  const { height, current } = await arweave.network.getInfo();

  const tx = await createTx(arweave, wallet, contractId, input);
 
  const dummyActiveTx: InteractionTx = {
    info: {
      status: 200,
      confirmed: {
        block_height: height,
        block_indep_hash: current,
        number_of_confirmations: 0,
      }
    },
    id: tx.id,
    tx: tx,
    sortKey: '',
    from: from,
  }

  contractInfo.swGlobal._activeTx = dummyActiveTx;

  const result = await execute(contractInfo.handler, interaction, latestState);
  return result.result
}


async function createTx(arweave: Arweave, wallet: JWKInterface, contractId: string, input: any) {
  let interactionTx = await arweave.createTransaction(
    {
      data: Math.random()
        .toString()
        .slice(-4)
    },
    wallet
  );

  if (!input) {
    throw new Error(`Input should be a truthy value: ${JSON.stringify(input)}`);
  }  

  interactionTx.addTag('App-Name', 'SmartWeaveAction');
  interactionTx.addTag('App-Version', '0.3.0');
  interactionTx.addTag('Contract', contractId);
  interactionTx.addTag('Input', JSON.stringify(input));

  await arweave.transactions.sign(interactionTx, wallet);
  return interactionTx;
}

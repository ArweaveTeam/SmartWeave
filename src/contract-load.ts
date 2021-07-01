import Arweave from 'arweave';
import * as clarity from '@weavery/clarity';
import { getTag, normalizeContractSource } from './utils';
import { ContractHandler } from './contract-step';
import { SmartWeaveGlobal } from './smartweave-global';
import BigNumber from 'bignumber.js';

/**
 * Loads the contract source, initial state and other parameters
 *
 * @param arweave     an Arweave client instance
 * @param contractID  the Transaction Id of the contract
 */
export async function loadContract(arweave: Arweave, contractID: string, contractSrcTXID?: string) {
  // Generate an object containing the details about a contract in one place.
  const contractTX = await arweave.transactions.get(contractID);
  const contractOwner = await arweave.wallets.ownerToAddress(contractTX.owner);

  contractSrcTXID = contractSrcTXID || getTag(contractTX, 'Contract-Src');

  const minFee = getTag(contractTX, 'Min-Fee');
  const contractSrcTX = await arweave.transactions.get(contractSrcTXID);
  const contractSrc = contractSrcTX.get('data', { decode: true, string: true });

  let state: string;
  if (getTag(contractTX, 'Init-State')) {
    state = getTag(contractTX, 'Init-State');
  } else if (getTag(contractTX, 'Init-State-TX')) {
    const stateTX = await arweave.transactions.get(getTag(contractTX, 'Init-State-TX'));
    state = stateTX.get('data', { decode: true, string: true });
  } else {
    state = contractTX.get('data', { decode: true, string: true });
  }

  const { handler, swGlobal } = createContractExecutionEnvironment(
    arweave,
    contractSrc,
    contractID,
    contractSrcTXID,
    contractOwner,
  );

  return {
    id: contractID,
    contractSrc,
    initState: state,
    minFee,
    contractTX,
    handler,
    swGlobal,
  };
}

/**
 * Translates a contract source code into a Js function that can be called, and sets
 * up two globals, SmartWeave and the ContractError exception.
 *
 * At the moment this uses the Function() constructor (basically the same as eval),
 * But the design is geared toward switching to Realms or something like
 * https://github.com/justjake/quickjs-emscripten. (probably the latter)
 *
 * In the current implemention, using Function(), the 'globals' are actually
 * just lexically scoped vars, unique to each instance of a contract.
 *
 * @param contractSrc the javascript source for the contract. Must declare a handle() function
 */
export function createContractExecutionEnvironment(
  arweave: Arweave,
  contractSrc: string,
  contractId: string,
  contractSrcId: string,
  contractOwner: string,
) {
  const returningSrc = normalizeContractSource(contractSrc);
  const swGlobal = new SmartWeaveGlobal(arweave, { id: contractId, contractSrcTxId: contractSrcId, owner: contractOwner });
  const getContractFunction = new Function(returningSrc); // eslint-disable-line

  // console.log(returningSrc);

  return {
    handler: getContractFunction(swGlobal, BigNumber, clarity) as ContractHandler,
    swGlobal,
  };
}

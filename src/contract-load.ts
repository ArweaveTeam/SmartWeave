import Arweave from 'arweave/node';
import { getTag } from './utils';
import { ContractHandler } from './contract-step';
import { SmartWeaveGlobal } from './smartweave-global';

/**
 * Loads the contract source, initial state and other parameters
 *
 * @param arweave     an Arweave client instance
 * @param contractID  the Transaction Id of the contract
 */
export async function getContract(arweave: Arweave, contractID: string) {
  
  // Generate an object containing the details about a contract in one place.
  const contractTX = await arweave.transactions.get(contractID);
  const contractSrcTXID = getTag(contractTX, 'Contract-Src');
  const minDiff = getTag(contractTX, 'Min-Diff');
  const minFee = getTag(contractTX, 'Min-Fee');
  const contractSrcTX = await arweave.transactions.get(contractSrcTXID);
  const contractSrc = contractSrcTX.get('data', { decode: true, string: true });
  const state = contractTX.get('data', { decode: true, string: true });

  //console.log(`${contractSrcTXID} (Src) \n`, contractSrc);
  //console.log(`${contractID} (State) \n`, state);

  const { handler, swGlobal } = getContractExecutionEnvironment(arweave, contractSrc);
  return {
    id: contractID,
    contractSrc: contractSrc,
    initState: state,
    minDiff: minDiff,
    minFee: minFee,
    contractTX,
    handler,
    swGlobal
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
export function getContractExecutionEnvironment(arweave: Arweave, contractSrc: string) {
  
  // Convert from ES Module format to something we can run inside a Function.
  // just replaces `export [async] function handle(` with `[async] function handle(`
  // and we add a `return
  contractSrc = contractSrc.replace(/export\s+async\s+function\s+handle/gmu, 'async function handle');
  contractSrc = contractSrc.replace(/export\s+function\s+handle\s/gmu, 'function handle');
  const ContractErrorDef = `class ContractError extends Error { constructor(message) { super(message); this.name = 'ContractError' } };`;
  const returningSrc = `const SmartWeave = svGlobal;\n\n${ContractErrorDef}\n\n${contractSrc}\n\n;return handle;`;
  const swGlobal = new SmartWeaveGlobal(arweave);
  const getContractFunction = new Function('svGlobal', returningSrc);
  
  //console.log(returningSrc);
  
  return {
    handler: getContractFunction(swGlobal) as ContractHandler,
    swGlobal
  };
}

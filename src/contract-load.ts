import Arweave from 'arweave/node'
import { getTag } from './utils'
import { ContractHandler } from './contract-step'
import { SmartWeaveGlobal } from './smartweave-global'
import BigNumber from 'bignumber.js'

/**
 * Loads the contract source, initial state and other parameters
 *
 * @param arweave     an Arweave client instance
 * @param contractID  the Transaction Id of the contract
 */
export async function loadContract (arweave: Arweave, contractID: string) {
  // Generate an object containing the details about a contract in one place.
  const contractTX = await arweave.transactions.get(contractID)
  const contractSrcTXID = getTag(contractTX, 'Contract-Src')
  const minFee = getTag(contractTX, 'Min-Fee')
  const contractSrcTX = await arweave.transactions.get(contractSrcTXID)
  const contractSrc = contractSrcTX.get('data', { decode: true, string: true })
  const state = contractTX.get('data', { decode: true, string: true })

  const { handler, swGlobal } = createContractExecutionEnvironment(arweave, contractSrc, contractID)

  return {
    id: contractID,
    contractSrc: contractSrc,
    initState: state,
    minFee: minFee,
    contractTX,
    handler,
    swGlobal
  }
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
export function createContractExecutionEnvironment (arweave: Arweave, contractSrc: string, contractId: string) {
  // Convert from ES Module format to something we can run inside a Function.
  // just removes the `export` keyword and adds ;return handle to the end of the function.
  // We also assign the passed in SmartWeaveGlobal to SmartWeave, and declare
  // the ContractError exception.
  // We then use `new Function()` which we can call and get back the returned handle function
  // which has access to the per-instance globals.

  contractSrc = contractSrc.replace(/export\s+async\s+function\s+handle/gmu, 'async function handle')
  contractSrc = contractSrc.replace(/export\s+function\s+handle/gmu, 'function handle')
  const ContractErrorDef = 'class ContractError extends Error { constructor(message) { super(message); this.name = \'ContractError\' } };'
  const ContractAssertDef = 'function ContractAssert(cond, message) { if (!cond) throw new ContractError(message) };'
  const returningSrc = `const BigNumber = bigNumberCtor; const SmartWeave = swGlobal;\n\n${ContractErrorDef}\n${ContractAssertDef}\n${contractSrc}\n\n;return handle;`
  const swGlobal = new SmartWeaveGlobal(arweave, { id: contractId })
  const getContractFunction = new Function('swGlobal', 'bigNumberCtor', returningSrc) // eslint-disable-line

  // console.log(returningSrc);

  return {
    handler: getContractFunction(swGlobal, BigNumber) as ContractHandler,
    swGlobal
  }
}

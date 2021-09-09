import Transaction from 'arweave/node/lib/transaction';
import Arweave from 'arweave';
import { GQLEdgeInterface } from './interfaces/gqlResult';

interface UnformattedTag {
  name: string;
  value: string;
}

export function getTag(tx: Transaction, name: string) {
  const tags = tx.get('tags') as any;

  for (const tag of tags) {
    // decoding tags can throw on invalid utf8 data.
    try {
      if (tag.get('name', { decode: true, string: true }) === name) {
        return tag.get('value', { decode: true, string: true });
      }
      // tslint:disable-next-line: no-empty
    } catch (e) { }
  }

  return false;
}

/**
 * Unpacks string tags from a Tx and puts in a KV map
 * Tags that appear multiple times will be converted to an
 * array of string values, ordered as they appear in the tx.
 *
 * @param tx
 */
export function unpackTags(tx: Transaction): Record<string, string | string[]> {
  const tags = tx.get('tags') as any;
  const result: Record<string, string | string[]> = {};

  for (const tag of tags) {
    try {
      const name = tag.get('name', { decode: true, string: true }) as string;
      const value = tag.get('value', { decode: true, string: true }) as string;
      if (!result.hasOwnProperty(name)) {
        result[name] = value;
        continue;
      }
      result[name] = [...result[name], value];
    } catch (e) {
      // ignore tags with invalid utf-8 strings in key or value.
    }
  }
  return result;
}

export function formatTags(tags: UnformattedTag[]): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};

  for (const tag of tags) {
    const { name, value } = tag;
    if (!result.hasOwnProperty(name)) {
      result[name] = value;
      continue;
    }
    result[name] = [...result[name], value];
  }

  return result;
}

export function arrayToHex(arr: Uint8Array) {
  let str = '';
  for (const a of arr) {
    str += ('0' + a.toString(16)).slice(-2);
  }
  return str;
}

export function log(arweave?: Arweave, ...str: string[]) {
  if (!arweave || !arweave.getConfig().api.logging) return;

  typeof arweave.getConfig().api.logger === 'function' ? arweave.getConfig().api.logger(...str) : console.log(...str);
}

export function normalizeContractSource(contractSrc: string): string {
  // Convert from ES Module format to something we can run inside a Function.
  // Removes the `export` keyword and adds ;return handle to the end of the function.
  // Additionally it removes 'IIFE' declarations
  // (which may be generated when bundling multiple sources into one output file
  // - eg. using esbuild's "IIFE" bundle format).
  // We also assign the passed in SmartWeaveGlobal to SmartWeave, and declare
  // the ContractError exception.
  // We then use `new Function()` which we can call and get back the returned handle function
  // which has access to the per-instance globals.

  contractSrc = contractSrc
    .replace(/export\s+async\s+function\s+handle/gmu, 'async function handle')
    .replace(/export\s+function\s+handle/gmu, 'function handle')
    .replace(/\(\s*\(\)\s*=>\s*{/g, '')
    .replace(/\s*\(\s*function\s*\(\)\s*{/g, '')
    .replace(/}\s*\)\s*\(\)\s*;/g, '');

  return `
    const [SmartWeave, BigNumber, clarity] = arguments;
    clarity.SmartWeave = SmartWeave;
    class ContractError extends Error { constructor(message) { super(message); this.name = \'ContractError\' } };
    function ContractAssert(cond, message) { if (!cond) throw new ContractError(message) };
    ${contractSrc};
    return handle;
  `;
}

/**
 * Function that evaluates the `settings` key of the state and return a valid Map.
 * @param state 
 * @returns {Map} settings as a map
 */
export function evalSettings(state: any): Map<string, any> {
  // default  - empty
  let settings = new Map<string, any>();
  if (state.settings) {
    // for Iterable format
    if (isIterable(state.settings)) {
      settings = new Map<string, any>(state.settings);
      // for Object format
    } else if (isObject(state.settings)) {
      settings = new Map<string, any>(Object.entries(state.settings));
    }
  }

  return settings;
}

/**
 * Checks if a variable is iterable.
 * @param obj variable to if is iterable
 * @returns 
 */
function isIterable(obj: unknown): boolean {
  // checks for null and undefined
  if (obj == null) {
    return false;
  }
  return typeof obj[Symbol.iterator] === 'function';
}

/**
 * Check wether the variable is an object.
 * @param obj variable to check if it's an object
 * @returns 
 */
function isObject(obj: unknown): boolean {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

/**
 * Checks if edge has multiple tags with the name 'Contract', which means multiple interactions.
 * @param gqlResult 
 * @returns {boolean} 
 */
export function hasMultipleinteractions(gqlResult: GQLEdgeInterface) {
  return gqlResult.node.tags.filter((tag) => tag.name === 'Contract').length > 1;
}
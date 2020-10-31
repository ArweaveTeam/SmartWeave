import Transaction from 'arweave/node/lib/transaction';
import Arweave from 'arweave';

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
    } catch (e) {}
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

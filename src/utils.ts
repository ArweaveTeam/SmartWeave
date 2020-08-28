
import Transaction from 'arweave/node/lib/transaction'
import Arweave from 'arweave'

export function getTag(tx: Transaction, name: string) {
  let tags = tx.get('tags') as any

  for(let i = 0; i < tags.length; i++) {
    // decoding tags can throw on invalid utf8 data.
    try {
      if(tags[i].get('name', { decode: true, string: true }) == name)
        return tags[i].get('value', { decode: true, string: true })
    } catch (e) {

    }
  }
      
  return false
}

/**
 * Unpacks string tags from a Tx and puts in a KV map 
 * Tags that appear multiple times will be converted to an
 * array of string values, ordered as they appear in the tx. 
 * 
 * @param tx 
 */
export function unpackTags(tx: Transaction): Record<string, string | string[]> {
  
  let tags = tx.get('tags') as any
  let result: Record<string, string | string[]> = {}
  
  for(let i = 0; i < tags.length; i++) {
    try {
      const name = tags[i].get('name', { decode: true, string: true }) as string 
      const value = tags[i].get('value', { decode: true, string: true }) as string 
      if (!result.hasOwnProperty(name)) {
        result[name] = value; 
        continue;
      }
      result[name] = [ ...result[name], value ]
    } catch (e) {
      // ignore tags with invalid utf-8 strings in key or value.
    }
  }
  return result; 
}

export function arrayToHex(arr: Uint8Array) {
  let str = ''
  for (let i = 0; i < arr.length; i++) {
      str += ("0"+arr[i].toString(16)).slice(-2)
  }
  return str;
}

export function log(arweave?: Arweave, ...str: string[]) {
  (arweave && typeof arweave.getConfig().api.logger == "function") ?
    arweave.getConfig().api.logger!(...str) :
    console.log(...str);
}

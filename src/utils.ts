
import Transaction from 'arweave/node/lib/transaction'

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

export function arrayToHex(arr: Uint8Array) {
  let str = ''
  for (let i = 0; i < arr.length; i++) {
      str += ("0"+arr[i].toString(16)).slice(-2)
  }
  return str;
}



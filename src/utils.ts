
import Transaction from 'arweave/node/lib/transaction'

export function getTag(TX: Transaction, name: string) {
  let tags = TX.get('tags') as any

  for(let i = 0; i < tags.length; i++)
      if(tags[i].get('name', { decode: true, string: true }) == name)
          return tags[i].get('value', { decode: true, string: true })

  return false
}

export function arrayToHex(arr: Uint8Array) {
  let str = ''
  for (let i = 0; i < arr.length; i++) {
      str += ("0"+arr[i].toString(16)).slice(-2)
  }
  return str;
}



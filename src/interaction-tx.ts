import Transaction from 'arweave/node/lib/transaction';
import { TransactionStatusResponse } from 'arweave/node/transactions';

/**
 * Holds all the info we need about an interaction Tx. 
 * This includes the Tx itself, aswell as info about the 
 * block it is in.
 */
export interface InteractionTx {
  tx: Transaction
  info: TransactionStatusResponse
  id: string
  sortKey: string
  from: string
}

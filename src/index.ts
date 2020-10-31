import { createContract, createContractFromTx } from './contract-create';
import { loadContract } from './contract-load';
import { interactWrite, interactWriteDryRun, interactRead } from './contract-interact';
import { readContract } from './contract-read';
import { selectWeightedPstHolder } from './weighted-pst-holder';

const smartweave = {
  createContract,
  createContractFromTx,
  loadContract,
  interactWrite,
  interactWriteDryRun,
  interactRead,
  readContract,
  selectWeightedPstHolder,
};

export {
  createContract,
  createContractFromTx,
  loadContract,
  interactWrite,
  interactWriteDryRun,
  interactRead,
  readContract,
  selectWeightedPstHolder,
  smartweave
};

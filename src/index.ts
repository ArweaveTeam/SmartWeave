import {
  simulateCreateContractFromTx,
  simulateCreateContractFromSource,
  createContract,
  createContractFromTx,
} from './contract-create';
import { loadContract } from './contract-load';
import { interactWrite, interactWriteDryRun, interactRead, interactWriteDryRunCustom } from './contract-interact';
import { readContract } from './contract-read';
import { selectWeightedPstHolder } from './weighted-pst-holder';

const smartweave = {
  simulateCreateContractFromTx,
  simulateCreateContractFromSource,
  createContract,
  createContractFromTx,
  loadContract,
  interactWrite,
  interactWriteDryRun,
  interactWriteDryRunCustom,
  interactRead,
  readContract,
  selectWeightedPstHolder,
};

export {
  simulateCreateContractFromTx,
  simulateCreateContractFromSource,
  createContract,
  createContractFromTx,
  loadContract,
  interactWrite,
  interactWriteDryRun,
  interactWriteDryRunCustom,
  interactRead,
  readContract,
  selectWeightedPstHolder,
  smartweave,
};

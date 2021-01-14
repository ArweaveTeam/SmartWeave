import { readFileSync, existsSync } from 'fs';
import Arweave from 'arweave';
import logger from 'loglevel';
import CLI from 'clui';
import chalk from 'chalk';
import beautify from 'json-beautify';

import * as Sdk from '..';
import { getTag } from '../utils';
import { assert, isExpectedType, getJsonInput } from './utils';

const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
  logging: false,
  timeout: 15000,
});

export async function readCommandHandler(argv: any) {
  // creates a spinner for the read command 
  const { Spinner } = CLI;
  const status = new Spinner(`Loading the status of the contract ${argv.contractId}, please wait...`);
  status.start();
  
  const contractId = argv.contractId;
  let input = argv.input;

  const jsonInput = getJsonInput(input);

  input = jsonInput || input;

  try {
    let result;

    if (input) {
      result = await Sdk.interactRead(arweave, undefined, contractId, input);
    } else {
      result = await Sdk.readContract(arweave, contractId);
    }
    status.stop();
    console.log(`
    🤓 ${chalk.green(`We found what you are looking for`)} 🤓

    The following is the current status of the contract ${chalk.bgBlack(chalk.white(contractId))}: 
    `);
    (argv.prettifyResult) ? console.log(beautify(result, null, 2, 100)) : console.log(
      result,
      `
    For a complete and prettier version of this status run:

      ${chalk.bgBlack(chalk.white(`smartweave read ${contractId} --prettify-result`))}
      `,
    );

  } catch (e) {
    status.stop();
    logger.error(`
    🤔 ${chalk.red('It seems that a contract having the txId:')} ${chalk.bgBlack(chalk.white(e.otherInfo.requestedTxId))} ${chalk.red('is not stored on the arweave')} 🤔

      Are you sure that the contract transaction you are trying to access was actually sent and confirmed?

      ${chalk.red(`If so, and if this link https://arweave.net/${e.otherInfo.requestedTxId} does not return:`)}

        {"status":400,"error":"Request type not found."} 
        
      ${chalk.red('please report this to https://www.arweave.org')}
    `);
  }
}

export async function writeCommandHandler(argv: any) {
  const contractId = argv.contractId;
  let input = argv.input;
  const dryRun = argv.dryRun;
  const wallet = JSON.parse(readFileSync(argv.keyFile).toString());

  const jsonInput = getJsonInput(input);
  input = jsonInput || input;

  try {
    let result;

    if (dryRun) {
      result = await Sdk.interactWriteDryRun(arweave, wallet, contractId, input);
      console.log(result);
    } else {
      result = await Sdk.interactWrite(arweave, wallet, contractId, input);
      console.log(`Interaction posted at: ${result}`);
    }
  } catch (e) {
    logger.error(e);
    logger.error('Unable to excute write.');
  }
}

export async function createCommandHandler(argv: any) {
  const contractSource = argv.contractSource;
  const initStateFile = argv.initStateFile;
  const wallet = JSON.parse(readFileSync(argv.keyFile).toString());

  assert(isExpectedType(initStateFile, 'json'), 'The state file must be a json file.');

  // we'll assume all sources that include `.` are a local path since `.` is not a valid char in a trasaction id
  if (contractSource.includes('.')) {
    assert(existsSync(contractSource), `The file name provided was not found in your file system: ${contractSource}`);

    assert(isExpectedType(contractSource, 'js'), 'The contract source must be a javascript file.');

    try {
      const contractId = await Sdk.createContract(
        arweave,
        wallet,
        readFileSync(contractSource).toString(),
        readFileSync(initStateFile).toString(),
      );
      console.log(`Contract ID: ${contractId}`);
    } catch (e) {
      logger.error(e);
      logger.error('Unable create contract');
    }
  } else {
    let sourceTx;

    try {
      sourceTx = await arweave.transactions.get(contractSource);

      const appTag = getTag(sourceTx, 'App-Name');

      assert(
        appTag && appTag === 'SmartWeaveContractSource',
        'The source transaction must be a valid smartweave contract source.',
      );
    } catch (e) {
      logger.error(e);
      logger.error(`Unable to find the transaction with your given contract source: ${contractSource}`);
      return;
    }

    try {
      const contractId = await Sdk.createContractFromTx(
        arweave,
        wallet,
        sourceTx.id,
        readFileSync(initStateFile).toString(),
      );
      console.log(`Contract ID: ${contractId}`);
    } catch (e) {
      logger.error(e);
      logger.error('Unable create the contract.');
    }
  }
}

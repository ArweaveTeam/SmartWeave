import { readFileSync, existsSync } from 'fs';
import Arweave from 'arweave';
import logger from 'loglevel';
import CLI from 'clui';
import chalk from 'chalk';
import beautify from 'json-beautify';
import Sentencer from 'sentencer';

import * as Sdk from '..';
import { getTag } from '../utils';
import { assert, isExpectedType, getJsonInput } from './utils';
import { askForContractCreationConfirmation } from './inquirer';

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
    (argv.prettify) ? console.log(beautify(result, null, 2, 100)) : console.log(
      result,
      `
    For a complete and prettier version of this status run:

      ${chalk.bgBlack(chalk.white(`smartweave read ${contractId} --prettify`))}
      `,
    );

  } catch (e) {
    status.stop();
    logger.error(`
    🤔 ${chalk.red('It seems that a contract having the TXID:')} ${chalk.bgBlack(chalk.white(e.otherInfo.requestedTxId))} ${chalk.red('is not stored on the arweave')} 🤔

      Are you sure that the contract transaction you are trying to access was actually sent and confirmed?

      ${chalk.red('If you feel so, please report this incident to our team at https://www.arweave.org!')}
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

  const { Spinner } = CLI;
  let status = new Spinner(``);
  let wallet = null;

  // checks if the user sent a valid key-file
  try {
    status = new Spinner(`Checking your key-file, please wait...`);
    status.start();
    wallet = JSON.parse(readFileSync(argv.keyFile).toString());
    status.stop();
  } catch (err) {
    status.stop();
    logger.error(`
    🤔 ${chalk.red('It seems that the key-file')} ${chalk.bgBlack(chalk.white(argv.keyFile))} ${chalk.red('is not in your file system')} 🤔

      Please double check the path of your key-file and try again! 
    `);
    process.exit(0);
  }

  // checks if the user sent a json as the initial status of the contract
  status = new Spinner(`Checking the initial JSON status you passed in, please wait...`);
  status.start();
  if (!isExpectedType(initStateFile, 'json')) {
    status.stop();
    logger.error(`
    🤔 ${chalk.red('It seems that')} ${chalk.bgBlack(chalk.white(initStateFile))} ${chalk.red('is not a JSON')} 🤔

      To create a contract you must pass in a valid JSON file as the initial state of your contract! 
    `);
    process.exit(0);
  }
  status.stop();

  // we'll assume all sources that include `.` are a local path since `.` is not a valid char in a trasaction id
  if (contractSource.includes('.')) {
    // assert(existsSync(contractSource), `The file name provided was not found in your file system: ${contractSource}`);

    // checks if the user has sent a contract source that exists in the filesystem
    status = new Spinner(`Checking your contract source, please wait...`);
    status.start();
    if (!existsSync(contractSource)) {
      status.stop();
      logger.error(`
      🤔 ${chalk.red('It seems that')} ${chalk.bgBlack(chalk.white(contractSource))} ${chalk.red('is not in your filesystem')} 🤔
  
        Please double check the path of your contract source and try again! 
      `);
      process.exit(0);
    }

    // assert(isExpectedType(contractSource, 'js'), 'The contract source must be a javascript file.');
    // checks if the user sent a js file as the contract source
    if (!isExpectedType(contractSource, 'js')) {
      status.stop();
      logger.error(`
      🤔 ${chalk.red('It seems that')} ${chalk.bgBlack(chalk.white(contractSource))} ${chalk.red('is not a javascript file')} 🤔
  
        To create a contract you must pass in a valid javascript file as the contract source of your contract! 
      `);
      process.exit(0);
    }
    status.stop();

    // simulates the create contract transaction and waits for the user confirmation
    status = new Spinner(`Computing the fee needed for creating your contract, please wait...`);
    status.start();

    const tx = await Sdk.simulateCreateContract(
      arweave,
      wallet,
      readFileSync(initStateFile).toString(),
      readFileSync(contractSource).toString(),
    );
    
    const userAddress = await arweave.wallets.jwkToAddress(wallet);
    const userBalance = arweave.ar.winstonToAr(await arweave.wallets.getBalance(userAddress));
    const expectedContractCreationFee = await arweave.ar.winstonToAr(tx.reward);
    const userBalanceAfterCreation = parseFloat(userBalance) - parseFloat(expectedContractCreationFee);
    const confirmRandomWord: string = Sentencer.make('{{ adjective }}');

    status.stop();
    if (userBalanceAfterCreation < 0) {
      logger.error(`
      😭 ${chalk.red('It seems that you do not have enough AR to create this contract')} 😭
  
      - To create this contract you need to pay a fee of ~${chalk.bgBlack(chalk.white(expectedContractCreationFee))} AR;
      - Your current wallet balance is ~${chalk.bgBlack(chalk.white(userBalance))} AR;

      ${chalk.red('So sorry for this ...')}
      `);
      process.exit(0);
    }

    console.log(`
      🤓 ${chalk.green(`Everything is ready for creating your contract! Please review the following info:`)} 🤓

      - To create this contract you need to pay a fee of ~${chalk.bgBlack(chalk.white(expectedContractCreationFee))} AR;
      - Your current wallet balance is ~${chalk.bgBlack(chalk.white(userBalance))} AR;
      - After the creation your wallet balance will be ~${chalk.bgBlack(chalk.white(userBalanceAfterCreation))} AR.     
    `);

    const resp = await askForContractCreationConfirmation(confirmRandomWord, expectedContractCreationFee);

    if (resp.payFeeForContractCreation.toUpperCase() !== confirmRandomWord.toUpperCase()) {
      logger.error(`
      🤷🏽‍♀️ ${chalk.red('Ok! No problem I will not publish your contract')} 🤷🏽‍♀️
  
      See you next time! 👋
      `);
      process.exit(0);
    }

    status = new Spinner(`Amazing! Let me deploy your contract, please wait...`);
    status.start();

    console.log(resp);
    process.exit(0);

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
import * as Sdk from '../';
import Arweave from 'arweave/node';
import yargs from 'yargs'
import logger from 'loglevel';
import { readFileSync, existsSync } from 'fs';

const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' })

// smartweave read [--input.function="hello"]   -- contractId 
// smartweave write --input.function --dry-run  -- contractId 
// smartweave create <sourceTx | sourceFile> <initStateFile> 
// smartweave info -- contractId

function readCommandHandler(argv: any) {
  const contractId = argv.contractId; 
  let input = argv.input;
  let jsonInput: any;
  try {
    jsonInput = typeof input === 'string' && JSON.parse(argv.input);
    jsonInput = typeof jsonInput === 'object' && jsonInput ? jsonInput : undefined
  } catch (e) {}
  input = jsonInput || input;
    if (input) {
      Sdk.interactRead(arweave, undefined, contractId, input)
        .then(x => console.log(x))
        .catch(e => {
          logger.error(e)
          logger.error(`Unable to read contract: ${contractId}`)
        })
    } 
    else {
      Sdk.readContract(arweave, contractId)
        .then(x => console.log(x))
        .catch(e => {
          logger.error(e)
          logger.error(`Unable to read contract: ${contractId}`)
        })
    }
}

function writeCommandHandler(argv: any) {
  const contractId = argv.contractId; 
  let input = argv.input;
  let jsonInput: any;
  let dryRun = argv.dryRun;
  let wallet = JSON.parse(readFileSync(argv.keyFile).toString())
  try {
    jsonInput = typeof input === 'string' && JSON.parse(argv.input);
    jsonInput = typeof jsonInput === 'object' && jsonInput ? jsonInput : undefined
  } catch (e) {}
  input = jsonInput || input;

    if (dryRun) {
      Sdk.interactWriteDryRun(arweave, wallet, contractId, input)
        .then(x => console.log(x))
        .catch(e => {
          logger.error(e)
          logger.error(`Unable to execute write (dry-run).`)
        })
    } 
    else {
      Sdk.interactWrite(arweave, wallet, contractId, input)
        .then(x => console.log(x))
        .catch(e => {
          logger.error(e)
          logger.error(`Unable to excute write.`)
        })
    }
}

function createCommandHandler(argv: any) {
  
  // TODO: refactor this to do early checks on everything for better error-reporting,
  // and make it async for readability.
  // - contractSource exists and seems to be a valid .js file or valid tx. 
  // - initState exists and seems to be a valid .jsonn file. 
  // - contractTx exists and seems to have valid tags.
  
  const contractSource = argv.contractSource; 
  const initStateFile = argv.initStateFile; 
  let wallet = JSON.parse(readFileSync(argv.keyFile).toString())
  
  if (existsSync(contractSource)) {
    Sdk.createContract(arweave, wallet, fs.readFileSync(contractSource).toString(), fs.readFileSync(initStateFile))
    .then(x => { 
      console.log(`Contract ID: ${x}`)
    })
    .catch(e => {
      logger.error(e)
      logger.error(`Unable create contract`);
    })
  } else {

    // Check TX exists. 
    // TODO: Check valid tags.
    arweave.transactions.get(contractSource)
    .then(tx => {
      Sdk.createContractFromTx(arweave, wallet, tx.id, fs.readFileSync(initStateFile).toString())
      .then(x => {
        console.log(`Contract ID: ${x}`)
      })
      .catch(e => {
        logger.error(e)
        logger.error(`Unable create contract`);
      })
    })
    .catch(e => {
      logger.error(e);
      logger.error(`Unable to get contract source tx: ${contractSource}`);
    })
  }
  
}


const readCommand: yargs.CommandModule = {
  command: 'read <contractId>', 
  describe: 'Read a contracts state or executes a read interaction.',
  builder: yargs =>
    yargs
      .options('input', {
        describe: 'Optional input to the contract, if not provided, contracts full state will be read'
      })
      .positional('contractId', { describe: 'The Contract ID', })
  ,
  handler: readCommandHandler
}

const writeCommand: yargs.CommandModule = { 
  command: 'write <contractId>', 
  describe: 'Writes an interaction with contract, or simulates a write interaction.',
  builder: yargs => 
    yargs
      .options({
        'key-file': {
          describe: 'Your key file',
          demandOption: true, 
        },
        'input': {
          describe: 'Input to the contract',
          demandOption: true, 
        },
        'dry-run': {
          describe: 'Simulate interaction and output contract state',
          boolean: true,
        }
      })
      .positional('contractId', { describe: 'The Contract ID' })
  ,
  handler: writeCommandHandler,
}

const createCommand: yargs.CommandModule = { 
  command: 'create <contractSource> <initStateFile>', 
  describe: 'Creates a new contract from a source file or existing contract source already on-chain.',
  builder: yargs => 
    yargs
      .options({
        'key-file': {
          describe: 'Your key file',
          demandOption: true, 
        }
      })
      .positional('contractSource', { describe: 'The contract source. A path to a .js file, or transaction id' })
      .positional('initStateFile', { describe: 'The initial state of the contract. Path to a .json file'})
  ,
  handler: argv => {
    console.log(argv);
  }
}

yargs
  .command(readCommand)
  .command(writeCommand)
  .command(createCommand)
  .demandCommand()
  .help()
  .argv


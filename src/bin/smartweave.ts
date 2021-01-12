#!/usr/bin/env node

import yargs, { exit } from 'yargs';
import logger from 'loglevel';

import initFiglet from './init-figlet';
import { readCommandHandler, writeCommandHandler, createCommandHandler } from './handlers';

// this contains all the messages printed by the CLI
import messages from '../static/messages.json';

// smartweave read [--input.function="hello"]   -- contractId
// smartweave write --input.function --dry-run  -- contractId
// smartweave create <sourceTx | sourceFile> <initStateFile>
// smartweave info -- contractId

initFiglet(messages.common.figletText);

const readCommand: yargs.CommandModule = {
  command: 'read <contractId>',
  describe: messages.commands.readCommand.description,
  builder: () =>
    yargs
      .options('input', {
        describe: messages.commands.readCommand.options.input.description,
        demandOption:false,
      })
      .positional('contractId', {
        describe: messages.commands.readCommand.positionals.contractId.description,
      }),
  handler: readCommandHandler,
};

const writeCommand: yargs.CommandModule = {
  command: 'write <contractId>',
  describe: 'Writes an interaction with contract, or simulates a write interaction.',
  builder: () =>
    yargs
      .options({
        'key-file': {
          describe: 'Your key file',
          demandOption: true,
        },
        input: {
          describe: 'Input to the contract',
          demandOption: true,
        },
        'dry-run': {
          describe: 'Simulate interaction and output contract state',
          boolean: true,
        },
      })
      .positional('contractId', {
        describe: 'The Contract ID'
      }),
  handler: writeCommandHandler,
};

const createCommand: yargs.CommandModule = {
  command: 'create <contractSource> <initStateFile>',
  describe: 'Creates a new contract from a source file or existing contract source already on-chain.',
  builder: () =>
    yargs
      .options({
        'key-file': {
          describe: 'Your key file',
          demandOption: true,
        },
      })
      .positional('contractSource', { describe: 'The contract source. A path to a .js file, or transaction id' })
      .positional('initStateFile', { describe: 'The initial state of the contract. Path to a .json file' }),
  handler: createCommandHandler,
};

// tslint:disable-next-line: no-unused-expression
yargs.command(readCommand).command(writeCommand).command(createCommand).demandCommand().help().argv;

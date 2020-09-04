import { readFileSync, existsSync } from 'fs'
import * as Sdk from '..'
import logger from 'loglevel'
import Arweave from 'arweave/node'

const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' })

export function readCommandHandler (argv: any) {
  const contractId = argv.contractId
  let input = argv.input

  // Support string JSON input & yargs `foo.bar=3` syntax.
  let jsonInput: any
  try {
    jsonInput = typeof input === 'string' && JSON.parse(argv.input)
    jsonInput = typeof jsonInput === 'object' && jsonInput ? jsonInput : undefined
  } catch (e) {}
  input = jsonInput || input

  if (input) {
    Sdk.interactRead(arweave, undefined, contractId, input)
      .then(x => console.log(x))
      .catch(e => {
        logger.error(e)
        logger.error(`Unable to read contract: ${contractId}`)
      })
  } else {
    Sdk.readContract(arweave, contractId)
      .then(x => console.log(x))
      .catch(e => {
        logger.error(e)
        logger.error(`Unable to read contract: ${contractId}`)
      })
  }
}

export function writeCommandHandler (argv: any) {
  const contractId = argv.contractId
  let input = argv.input
  let jsonInput: any
  const dryRun = argv.dryRun
  const wallet = JSON.parse(readFileSync(argv.keyFile).toString())
  try {
    jsonInput = typeof input === 'string' && JSON.parse(argv.input)
    jsonInput = typeof jsonInput === 'object' && jsonInput ? jsonInput : undefined
  } catch (e) {}
  input = jsonInput || input

  if (dryRun) {
    Sdk.interactWriteDryRun(arweave, wallet, contractId, input)
      .then(x => console.log(x))
      .catch(e => {
        logger.error(e)
        logger.error('Unable to execute write (dry-run).')
      })
  } else {
    Sdk.interactWrite(arweave, wallet, contractId, input)
      .then(x => console.log(x))
      .catch(e => {
        logger.error(e)
        logger.error('Unable to excute write.')
      })
  }
}

export function createCommandHandler (argv: any) {
  // TODO: refactor this to do early checks on everything for better error-reporting,
  // and make it async for readability.
  // - contractSource exists and seems to be a valid .js file or valid tx.
  // - initState exists and seems to be a valid .jsonn file.
  // - contractTx exists and seems to have valid tags.

  const contractSource = argv.contractSource
  const initStateFile = argv.initStateFile
  const wallet = JSON.parse(readFileSync(argv.keyFile).toString())

  if (existsSync(contractSource)) {
    Sdk.createContract(arweave, wallet, readFileSync(contractSource).toString(), readFileSync(initStateFile).toString())
      .then(x => {
        console.log(`Contract ID: ${x}`)
      })
      .catch(e => {
        logger.error(e)
        logger.error('Unable create contract')
      })
  } else {
    // Check TX exists.
    // TODO: Check valid tags.
    arweave.transactions.get(contractSource)
      .then(tx => {
        Sdk.createContractFromTx(arweave, wallet, tx.id, readFileSync(initStateFile).toString())
          .then(x => {
            console.log(`Contract ID: ${x}`)
          })
          .catch(e => {
            logger.error(e)
            logger.error('Unable create contract')
          })
      })
      .catch((e: any) => {
        logger.error(e)
        logger.error(`Unable to get contract source tx: ${contractSource}`)
      })
  }
}

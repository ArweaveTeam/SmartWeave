/*
 * Remove cjs module lines that cause trouble for the SmartWeave SDK
 */

const fs = require('fs')
const path = require('path')

const CONTRACT_PATH = path.resolve(__dirname, '../../build/community.js')

let contractSrc = fs.readFileSync(CONTRACT_PATH, 'utf8')

contractSrc = trim(contractSrc)

fs.writeFileSync(CONTRACT_PATH, contractSrc)

function trim (contractSrc) {
  contractSrc = contractSrc.replace('Object.defineProperty(exports, \'__esModule\', { value: true });', '')
  contractSrc = contractSrc.replace('exports.handle = handle;', '')
  return contractSrc
}

import Arweave from 'arweave';

import { readContract } from './src';
import fs from 'fs';


async function main() {
  const evolveContractTxId = "usjm4PCxUd5mtaon7zc97-dt-3qf67yPyqgzLnLqk5A"

  const arweave = Arweave.init({
    host: 'arweave.net',// Hostname or IP address for a Arweave host
    port: 443,          // Port
    protocol: 'https',  // Network protocol http or https
    timeout: 20000,     // Network request timeouts in milliseconds
    logging: false,     // Enable network request logging
  });

  const state = await readContract(arweave, evolveContractTxId);

  fs.writeFileSync('evolve.new.json', JSON.stringify(state));
}

main();

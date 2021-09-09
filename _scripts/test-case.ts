import Arweave from 'arweave';
import { readContract } from '../src';

async function main() {
  const arweave = Arweave.init({
    host: 'arweave.net', // Hostname or IP address for a Arweave host
    port: 443, // Port
    protocol: 'https', // Network protocol http or https
    timeout: 60000, // Network request timeouts in milliseconds
    logging: false // Enable network request logging
  });
  const contractTxId = 'YLVpmhSq5JmLltfg6R-5fL04rIRPrlSU22f6RQ6VyYE';

  const { state, validity } = await readContract(arweave, contractTxId);
}

main().catch((e) => {
  console.error(e);
});

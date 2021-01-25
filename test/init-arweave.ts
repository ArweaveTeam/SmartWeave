import Arweave from "arweave";

const arweaveInstance = new Arweave({
    host: "arweave.net",
    protocol: "https",
    port: 443,
    logging: false,
    timeout: 15000,
});
  
export default arweaveInstance;
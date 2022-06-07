import fs from 'fs';
import fetch from 'node-fetch';

import ArLocal from 'arlocal';
import Arweave from 'arweave';

import { createContract } from '../contract-create';
import { interactWrite } from '../contract-interact';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { readContract } from '../contract-read';

let inst: Arweave;
let arlocal: ArLocal;

describe('Testing the evolve feature', () => {
  let contractSrcFile = '';
  let evolvedContractSrcFile = '';
  let evolvedContractTxId = '';
  let initialStateFile = {};
  let contract = '';

  let wallet: JWKInterface;
  let addy = '';

  beforeAll(async () => {
    arlocal = new ArLocal(1985, false);
    await arlocal.start();

    inst = Arweave.init({
      host: 'localhost',
      port: 1985,
      protocol: 'http',
    });

    wallet = await inst.wallets.generate();
    addy = await inst.wallets.jwkToAddress(wallet);

    contractSrcFile = fs.readFileSync('examples/token-pst.js', 'utf8');
    evolvedContractSrcFile = fs.readFileSync('examples/token-evolve.js', 'utf8');
    initialStateFile = JSON.parse(fs.readFileSync('examples/token-pst.json', 'utf8'));

    await fetch(`http://localhost:1985/mint/${addy}/1000000000`);
    initialStateFile['balances'][addy] = 100;
    initialStateFile['owner'] = addy;

    contract = await createContract(inst, wallet, contractSrcFile, JSON.stringify(initialStateFile));

    const tx = await inst.createTransaction({ data: evolvedContractSrcFile }, wallet);
    tx.addTag('App-Name', 'SmartWeaveContractSource');
    tx.addTag('App-Version', '0.3.0');
    tx.addTag('Content-Type', 'application/javascript');

    await inst.transactions.sign(tx, wallet);
    evolvedContractTxId = tx.id;
    await inst.transactions.post(tx);

    await mine();
  });

  afterAll(async () => {
    await arlocal.stop();
  });

  test('evolve any contract', async () => {
    // Reduce balance, should be at 50
    await interactWrite(inst, wallet, contract, {
      function: 'transfer',
      target: 'uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M',
      qty: 50,
    });
    await mine();

    const state = await readContract(inst, contract);
    expect(state.balances[addy]).toBe(50);

    // Evolve
    await interactWrite(inst, wallet, contract, { function: 'evolve', value: evolvedContractTxId });
    await mine();

    // Reduce balance, should be 10
    await interactWrite(inst, wallet, contract, {
      function: 'transfer',
      target: 'uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M',
      qty: 50,
    });
    await mine();

    const stateEvolved = await readContract(inst, contract);
    expect(stateEvolved.balances[addy]).toBe(10);
  });
});

async function mine() {
  await inst.api.get('mine');
}

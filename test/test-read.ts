
import * as chai from "chai";
import arweaveInstance from "./init-arweave";
import { readContract } from "../src/index";
import Ar from "arweave/node/ar";

const arDriveContract = '-8A6RexFkpfWwuyVO98wzSFZh0d6VJuI-buTJvlwOJQ';
const testVerseContract = 'p6uhGhOrsDin0yNbFKmY7g9ho6_nXqV_Yg3BrSxphnQ';
const expect = chai.expect;

const testRead = () => {
    describe("Checking the ardrive contract", async () => {
        let status;
        before(async function () {
            this.timeout(10000);
            status = await readContract(
                arweaveInstance,
                arDriveContract,
            );
        })
        it("should have balance for aLemOhg9OGovn-0o4cOCbueiHT9VgdYnpJpq7NgMA1A equal to 2", async function () {
            expect(status.balances['aLemOhg9OGovn-0o4cOCbueiHT9VgdYnpJpq7NgMA1A']).to.equal(2);
        });
        it("the total supply of the token (balances + vaults) should be equal to 6,282,550", async function () {
            // sum the balances
            const values: Array<number> = Object.values(status.balances)
            const sum: number = values.reduce((a:number, b:number) : number => a + b);
            
            // sum the vaults
            const vaults: Array<Object> = Object.entries(status.vault);
            let vaultsSum = 0; 
            vaults.forEach((v) => {
                const vaultSum = (v[1].length) ? v[1].map(a => a.balance).reduce((a, b) => a + b) : 0;
                vaultsSum = vaultsSum + vaultSum; 
            });

            expect(sum).to.equal(2894615);
            expect(vaultsSum).to.equal(3387935);
            expect(vaultsSum + sum).to.equal(6282550);
        });
    });
};

export default testRead;
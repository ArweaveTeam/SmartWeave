import { SmartWeaveGlobal } from '../smartweave-global';

const swGlobal = new SmartWeaveGlobal({} as any, null);
const contractSrc = `
function handle(action, state) {
  return {result: SmartWeave.block}
}
`;
const currentBlockMock = jest.fn();

import Arweave from 'arweave';
import { normalizeContractSource } from '../utils';
import { interactRead } from '../contract-interact';

jest.mock('../contract-load', () => ({
  loadContract: jest.fn().mockReturnValue({
    swGlobal: swGlobal,
    handler: new Function(normalizeContractSource(contractSrc))(swGlobal, {}, {}),
  }),
}));

jest.mock('../contract-read', () => ({
  readContract: jest.fn().mockReturnValue({}),
}));

jest.mock('arweave', () => ({
  init: jest.fn().mockReturnValue({
    transactions: {
      sign: jest.fn(),
    },
    blocks: {
      getCurrent: currentBlockMock,
    },
    createTransaction: jest.fn().mockResolvedValue({
      addTag: jest.fn(),
      get: jest.fn().mockReturnValue([]),
    }),
  }),
}));

describe('interactRead function', () => {
  it('should set active transaction block timestamp to the timestamp of current block', async () => {
    const arweave = Arweave.init({});

    currentBlockMock.mockResolvedValue({
      timestamp: 666777,
      indep_hash: '555_22b',
      height: 431,
    });

    const result = await interactRead(arweave, undefined, 'testTxId', {});

    expect(result.indep_hash).toEqual('555_22b');
    expect(result.height).toEqual(431);
    expect(result.timestamp).toEqual(666777);

    currentBlockMock.mockResolvedValue({
      timestamp: 111222,
      indep_hash: '22b_555',
      height: 78433,
    });

    const result2 = await interactRead(arweave, undefined, 'testTxId', {});

    expect(result2.indep_hash).toEqual('22b_555');
    expect(result2.height).toEqual(78433);
    expect(result2.timestamp).toEqual(111222);
  });
});

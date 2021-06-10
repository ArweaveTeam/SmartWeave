import { normalizeContractSource } from '../utils';

describe('normalizeContractSource function', () => {
  const exampleSrcIIFEArrow = `
    (() => {
      function handle(state, action) {
      }
    })();
    `;
  const exampleSrcIIFEArrowWeirdFormatting = `
    ( ()    =>  {
      function handle(state, action) {
      }
    } )  () ;
    `;

  const exampleSrcIIFE = `
    (function() {
      function handle(state, action) {
      }
    })();
    `;

  const exampleSrcIIFEWeirdFormatting = `
    (   function ()   {
      function handle(state, action) {
      }
    } )   ()  ;
    `;

  it('should remove IIFE written as arrow functions', () => {
    expect(normalizeContractSource(exampleSrcIIFEArrow)).toEqual(
      '\n' +
        '    const [SmartWeave, BigNumber, clarity] = arguments;\n' +
        '    clarity.SmartWeave = SmartWeave;\n' +
        "    class ContractError extends Error { constructor(message) { super(message); this.name = 'ContractError' } };\n" +
        '    function ContractAssert(cond, message) { if (!cond) throw new ContractError(message) };\n' +
        '    \n' +
        '    \n' +
        '      function handle(state, action) {\n' +
        '      }\n' +
        '    \n' +
        '    ;\n' +
        '    return handle;\n' +
        '  ',
    );

    expect(normalizeContractSource(exampleSrcIIFEArrowWeirdFormatting)).toEqual(
      '\n' +
        '    const [SmartWeave, BigNumber, clarity] = arguments;\n' +
        '    clarity.SmartWeave = SmartWeave;\n' +
        "    class ContractError extends Error { constructor(message) { super(message); this.name = 'ContractError' } };\n" +
        '    function ContractAssert(cond, message) { if (!cond) throw new ContractError(message) };\n' +
        '    \n' +
        '    \n' +
        '      function handle(state, action) {\n' +
        '      }\n' +
        '    \n' +
        '    ;\n' +
        '    return handle;\n' +
        '  ',
    );
  });

  it('should remove IIFE written as standard functions', () => {
    expect(normalizeContractSource(exampleSrcIIFE)).toEqual(
      '\n' +
        '    const [SmartWeave, BigNumber, clarity] = arguments;\n' +
        '    clarity.SmartWeave = SmartWeave;\n' +
        "    class ContractError extends Error { constructor(message) { super(message); this.name = 'ContractError' } };\n" +
        '    function ContractAssert(cond, message) { if (!cond) throw new ContractError(message) };\n' +
        '    \n' +
        '      function handle(state, action) {\n' +
        '      }\n' +
        '    \n' +
        '    ;\n' +
        '    return handle;\n' +
        '  ',
    );

    expect(normalizeContractSource(exampleSrcIIFEWeirdFormatting)).toEqual(
      '\n' +
        '    const [SmartWeave, BigNumber, clarity] = arguments;\n' +
        '    clarity.SmartWeave = SmartWeave;\n' +
        "    class ContractError extends Error { constructor(message) { super(message); this.name = 'ContractError' } };\n" +
        '    function ContractAssert(cond, message) { if (!cond) throw new ContractError(message) };\n' +
        '    \n' +
        '      function handle(state, action) {\n' +
        '      }\n' +
        '    \n' +
        '    ;\n' +
        '    return handle;\n' +
        '  ',
    );
  });
});

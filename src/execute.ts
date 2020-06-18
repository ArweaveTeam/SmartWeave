/**
 * Executes a single interaction against the contract source code and state, and 
 * returns the new state, or 'false' if there was an error.
 * 
 * Callers should replay all interactions in the correct order to get the correct
 * state to execute against.
 * 
 * @param contractSrc   the source code of the contract
 * @param input         the input interaction, should be a plain Js object
 * @param state         the current state of the contract
 * @param caller        the wallet address of the caller who is interacting with the contract
 */
export async function execute(contractSrc: string, input: object, state: object, caller: string) {
  // Load input into a variable accessible in the environment
  var input = input

  // Load current state into a variable accessible in the environment
  var state = state

  // Load network metadata into an accessible var.
  var network = {}
  var caller = caller

  // Execute the contract, catching failures
  try {
      eval(contractSrc)
  } catch (err) {
      console.error(err);
      return false
  }

  // Return the modified state
  return state
}
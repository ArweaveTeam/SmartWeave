
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
import logger from 'loglevel';

export function assert(expression: boolean, message: string) {
  if (!expression) {
    logger.error(`ERROR: ${message}`);
    process.exit(0);
  }
}

export function isExpectedType(filename: string, ext: string): boolean {
  return filename.split('.').pop() === ext;
}

// Support string JSON input & yargs `foo.bar=3` syntax.
export function getJsonInput(input: string): object | undefined {
  let jsonInput: any;
  try {
    jsonInput = typeof input === 'string' && JSON.parse(input);
    jsonInput = typeof jsonInput === 'object' && jsonInput ? jsonInput : undefined;
  } catch (e) {}

  return jsonInput;
}

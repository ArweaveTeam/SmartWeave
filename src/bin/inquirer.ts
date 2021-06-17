import inquirer from 'inquirer';

interface InquirerResult {
  payFeeForContractCreation?: string;
  payFeeForContractInteraction?: string;
}

export const askForContractCreationConfirmation = async (
  randWord: string,
  expectedContractCreationFee: string,
): Promise<InquirerResult> => {
  const questions = [
    {
      name: 'payFeeForContractCreation',
      type: 'input',
      message: `💸 Do you want to pay a fee of ${expectedContractCreationFee} AR to publish your contract? 💸 If so, write this random adjective: ${randWord.toUpperCase()} and press ENTER (otherwise type anything else):`,
    },
  ];
  return inquirer.prompt(questions);
};

export const askForContractInteractionConfirmation = async (
  randWord: string,
  expectedContractInteractionFee: string,
): Promise<InquirerResult> => {
  const questions = [
    {
      name: 'payFeeForContractInteraction',
      type: 'input',
      message: `💸 Do you want to pay a fee of ${expectedContractInteractionFee} AR to interact with this contract? 💸 If so, write this random adjective: ${randWord.toUpperCase()} and press ENTER (otherwise type anything else):`,
    },
  ];
  return inquirer.prompt(questions);
};

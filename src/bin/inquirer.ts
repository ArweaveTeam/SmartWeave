import inquirer from 'inquirer';

interface InquirerResult {
    payFeeForContractCreation: string;
}

export const askForContractCreationConfirmation = async (
    randWord: string,
    expectedContractCreationFee: string
): Promise<InquirerResult> => {
    const questions = [
        {
            name: 'payFeeForContractCreation',
            type: 'input',
            message: `💸 Do you want to pay a fee of ${expectedContractCreationFee} AR to publish your contract? 💸 If so, write ${randWord.toUpperCase()} and press ENTER (otherwise type anything else):`,
        
        },
    ];
    return inquirer.prompt(questions);
};

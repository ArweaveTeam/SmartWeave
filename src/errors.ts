export const enum SmartWeaveErrorType {
    CONTRACT_NOT_FOUND = "CONTRACT_NOT_FOUND",
}

export default class SmartWeaveError extends Error {
    public readonly type: SmartWeaveErrorType;

    constructor(
        type: SmartWeaveErrorType,
        optional: {
            message?: string;
        } = {}
    ) {
        if (optional.message) {
            super(optional.message);
        } else {
            super();
        }
        this.type = type;
    }

    public getType(): SmartWeaveErrorType {
        return this.type;
    }
}
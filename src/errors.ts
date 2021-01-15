export const enum SmartWeaveErrorType {
    CONTRACT_NOT_FOUND = "CONTRACT_NOT_FOUND",
}

export default class SmartWeaveError extends Error {
    public readonly type: SmartWeaveErrorType;
    public readonly otherInfo: Object;

    constructor(
        type: SmartWeaveErrorType,
        optional: {
            message?: string;
            requestedTxId?: string;
        } = {}
    ) {
        if (optional.message) {
            super(optional.message);
        } else {
            super();
        }
        this.type = type;
        this.otherInfo = optional;
    }

    public getType(): SmartWeaveErrorType {
        return this.type;
    }
}
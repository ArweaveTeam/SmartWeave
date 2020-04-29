module.exports = {
    createContract: async function(arweave, wallet, contractSrc, initState, minDiff) {
        // Create a TX to store the contract source, then create a contract from that src.
        // This allows contract source code to be audited seperately to contracts, and for
        // users to be sure that a contract they are using is executed trusted source code.
        let srcTX = await arweave.createTransaction({ data: contractSrc }, wallet)
        srcTX.addTag('App-Name', 'SmartWeave')
        srcTX.addTag('Type', 'contractSrc')
        srcTX.addTag('Version', '0.0.1')
        await arweave.transactions.sign(srcTX, wallet)

        const response = await arweave.transactions.post(srcTX)

        if((response.status == 200) || (response.status == 208))
            return this.createContractFromTX(arweave, wallet, srcTX.id, initState, minDiff)
        else
            return false
    },

    createContractFromTX: async function(arweave, wallet, srcTXID, state, minDiff) {
        // Create a contract from a stored source TXID, setting the default state.
        let contractTX = await arweave.createTransaction({ data: state }, wallet)
        contractTX.addTag('App-Name', 'SmartWeave')
        contractTX.addTag('Type', 'contract')
        contractTX.addTag('Contract-Src', srcTXID)
        contractTX.addTag('Version', '0.0.1')

        await arweave.transactions.sign(contractTX, wallet)

        const response = await arweave.transactions.post(contractTX)
        if((response.status == 200) || (response.status == 208))
            return contractTX.id
        else
            return false
    },

    getState: async function(arweave, contractID) {
        // Return the current state (as a string) for a contract.
        const tipTX = await this.findContractTip(arweave, contractID)
        if(!tipTX)
            return false
        
        console.log(tipTX)
        return tipTX.get('data', {decode: true, string: true})
    },

    execute: async function(contractSrc, input, state, caller) {
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
        } catch (e) {
            return false
        }

        // Return the modified state
        return state
    },

    validateStateTransition: async function(contractSrc, state, input, newState, caller) {
        return this.execute(contractSrc, input, state) == newState
    },

    interact: async function(arweave, wallet, contractID, input) {
        // Call a contract with new input, storing the resulting TX on-weave.
        // In order to execute this, the client first locates the top valid tip in the network,
        // executes the contract, and saves the new resulting contract.
        // Other clients can then pick-up this new state, validate the state transitions,
        // and add their own transactions to the top of the chain for the contract.
        const tipTX = await findContractTip(arweave, contractID)
        const contractTX = await arweave.transactions.get(contractID)
        const contractSrcTXID = contractTX.get('tags')['Contract-Src']
        const contractSrcTX = await arweave.transactions.get(contractSrcTXID)
        const contractSrc = contractSrcTX.get('data', {decode: true, string: true})
        const state = JSON.parse(tipTX.get('data', {decode: true, string: true}))['newState']
        const address = await arweave.wallets.jwkToAddress(wallet)

        // Calcualte the state after our new TX has been processed.
        const newState = this.execute(contractSrc, input, state, caller)

        if(!newState)
            return false

        // Generate POW, using last tip TXID as challenge.
        // This creates a cost to contract submission (controllable by the contract
        // initiator), discouraging spam (on top of the Arweave TX submission fee).
        const nonce = this.generatePOW(tipTX.id)

        // Package new state into new TX, add POW
        let interactionTX = arweave.createTransaction({
            data: JSON.stringify({newState: newState, input: input})
        }, wallet)

        interactionTX.addTag('App-Name', 'SmartWeave')
        interactionTX.addTag('Type', 'interaction')
        interactionTX.addTag('With-Contract', contractID)
        interactionTX.addTag('Previous-TX', tipTX.id)
        interactionTX.addTag('Nonce', nonce)
        interactionTX.addTag('Version', '0.0.1')

        const response = await arweave.transactions.post(interactionTX)
        console.log(response.status)

        if(response.status != 200)
            return false
        
        return interactionTX.id
    },

    findContractTip: async function(arweave, contractID) {
        const contract = await this.getContract(arweave, contractID)

        // Find all of the contract interaction transactions, ordered by newest 
        // first. Currently, block order will determine which transactions are valid.
        let tipQuery =
            {
                op: 'and',
                expr1:
                    {
                        op: 'equals',
                        expr1: 'App-Name',
                        expr2: 'SmartWeave'
                    },
                expr2:
                    {
                        op: 'equals',
                        expr1: 'With-Contract',
                        expr2: contractID
                    }
            }
        const possibleTips = await this.arweave.api.post(`arql`, tipQuery)
        
        // If there are no TXs on the contract yet, return the contract ID.
        if(possibleTips.data == '')
            return contractID
        
        // Else, Attempt to validate each tip in turn, until a valid path is found.
        for(i = 0; i < possibleTips.length; i++) {
            let tipTX = validateContractTip(arweave, contract, possibleTips[i])
            if(!tipTX)
                return tipTX
        }
    },

    validateContractTip: async function(arweave, contract, contractSrc, tipTXID) {
        // Validate POWs, working from the tip towards the contract TX.
        // Along the way, build up a stack of transactions (and contained state
        // transitions) to validate.
        let transitionsToValidate = []
        let tipTX = await arweave.transactions.get(tipTXID)
        let currentTX = tipTX
        let previousTXID = tipTX.get('tags')['Previous-TX']

        while(previousTXID != contract.id) {
            if(!this.verifyPOW(previousTXID, currentTX.get('tags')['Nonce'], contract.minDiff))
                return false
            transitionsToValidate.push(currentTX)
            if(!(currentTX = await arweave.transactions.get(previousTXID)))
                return false
            if(!(previousTXID = currentTX.get('tags')['Previous-TX']))
                return false
        }

        // Validate state transitions that have been pushed to the stack.

        let state = contract.initState
        while(transitionsToValidate.length > 0) {
            let nextTX = transitionsToValidate.pop()
            let caller = await arweave.wallets.ownerToAddress(nextTX.owner)
            let struct = JSON.parse(nextTX.get('data', {decode: true, string: true}))
            if(!this.validateStateTransition(contract.contractSrc, state, struct.input, struct.newState, caller))
                return false
            state = struct.newState
        }

        // Path is valid! Return the tip TX.
        return tipTX
    },

    getContract: async function(arweave, contractID) {
        // Generate an object containing the details about a contract in one place.
        const contractTX = await arweave.transactions.get(contractID)
        const contractSrcTXID = contractTX.get('tags')['Contract-Src']
        const minDiff = contractTX.get('tags')['Min-Diff']
        const contractSrcTX = await arweave.transactions.get(contractSrcTXID)
        const contractSrc = contractSrcTX.get('data', {decode: true, string: true})
        const state = contractTX.get('data', {decode: true, string: true})

        return {
            id: contractID,
            contractSrc: contractSrc,
            initState: state,
            minDiff: minDiff
        }
    },

    generatePOW: async function(challenge) {
        return ""
    },

    verifyPOW: async function(challenge, nonce, minDiff) {
        return true
    }
 }
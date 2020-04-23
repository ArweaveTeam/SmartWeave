module.exports = {
    createContract: async function(arweave, wallet, contractSrc, initState, minDiff) {
        let srcTX = arweave.createTransaction({ data: contractSrc }, wallet)

        srcTX.addTag('App-Name', 'SmartWeave')
        srcTX.addTag('Type', 'contractSrc')
        srcTX.addTag('Version', '0.0.1')

        await arweave.transactions.sign(srcTX, wallet)
        console.log(srcTX)

        const response = await arweave.transactions.post(srcTX)
        console.log(response.status)

        if(response.status != 200)
            return false

        return createContractFromTX(arweave, wallet, srcTX.id, initState, minDiff)
    },

    createContractFromTX: async function(arweave, wallet, srcTX, state, minDiff) {
        let contractTX = arweave.createTransaction({ data: state }, wallet)

        contractTX.addTag('App-Name', 'SmartWeave')
        contractTX.addTag('Type', 'contract')
        contractTX.addTag('Contract-Src', srcTX)
        contractTX.addTag('Version', '0.0.1')

        await arweave.transactions.sign(contractSrcTX, wallet)
        console.log(contractTX)

        const response = await arweave.transactions.post(contractTX)
        console.log(response.status)

        if(response.status != 200)
            return false
        
        return contractTX.id
    },

    getState: async function(arweave, contractID) {
        const tipTX = this.findContractTip(arweave, contractID)
        if(!tipTX)
            return false
        
        return tipTX.get('data', {decode: true, string: true})
    },

    execute: async function(contractSrc, input, state) {
        // Load input into a variable accessible in the environment
        var input = input

        // Load current state into a variable accessible in the environment
        var state = state

        // Load network metadata into an accessible var.
        var network = {}

        // Execute the contract, catching failures
        try {
            eval(contractSrc)
        } catch (e) {
            return false
        }

        // Return the modified state
        return state
    },

    validateStateTransition: async function(contractSrc, state, input, newState) {
        return this.execute(contractSrc, input, state) == newState
    },

    interact: async function(arweave, wallet, contractID, input) {
        const tipTX = await findContractTip(arweave, contractID)
        const contractTX = await arweave.transactions.get(contractID)
        const contractSrcTXID = contractTX.get('tags')['Contract-Src']
        const contractSrcTX = await arweave.transactions.get(contractSrcTXID)
        const contractSrc = contractSrcTX.get('data', {decode: true, string: true})
        const state = JSON.parse(tipTX.get('data', {decode: true, string: true}))['newState']

        // Call execute
        const newState = this.execute(contractSrc, input, state)

        if(!newState)
            return false

        // Generate POW, using last tip TXID as challenge
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
        // Validate POWs
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

        // Validate state transitions

        let state = contract.initState
        while(transitionsToValidate.length > 0) {
            let nextTX = transitionsToValidate.pop()
            let struct = JSON.parse(nextTX.get('data', {decode: true, string: true}))
            if(!this.validateStateTransition(contract.contractSrc, state, struct.input, struct.newState))
                return false
            state = struct.newState
        }

        // Path is valid! Return the tip TX.
        return tipTX
    },

    getContract: async function(arweave, contractID) {
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
            minDiff = minDiff
        }
    },

    generatePOW: async function(challenge) {
        return ""
    },

    verifyPOW: async function(challenge, nonce, minDiff) {
        return true
    }
 }
const { retryWithBackoff, batch, softFailWith } = require('promises-tho');

module.exports = {
    createContract: async function(arweave, wallet, contractSrc, initState, minDiff) {
        // Create a TX to store the contract source, then create a contract from that src.
        // This allows contract source code to be audited seperately to contracts, and for
        // users to be sure that a contract they are using is executed trusted source code.
        let srcTX = await arweave.createTransaction({ data: contractSrc }, wallet)
        srcTX.addTag('App-Name', 'SmartWeave')
        srcTX.addTag('Type', 'contractSrc')
        srcTX.addTag('Version', '0.2.0')
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
        contractTX.addTag('Version', '0.2.0')

        await arweave.transactions.sign(contractTX, wallet)

        const response = await arweave.transactions.post(contractTX)
        if((response.status == 200) || (response.status == 208))
            return contractTX.id
        else
            return false
    },

    // un-used
    getState: async function(arweave, contractID) {
        // Return the current state (as a string) for a contract.
        const tipTX = await this.findContractTip(arweave, contractID)
        if(!tipTX)
            return false
        
        return this.getTXState(tipTX)
    },

    // Replays all interactions with the contract to derive the current state
    // height optionally limits the heigh we replay to. 
    // Returns state as plain Js object.
    replayToState: async function(arweave, contractID, height = Number.POSITIVE_INFINITY) {
        
        const contractInfo = await this.getContract(arweave, contractID);

        let state; 
        try {
            state = JSON.parse(contractInfo.initState);
        } catch (e) {
            throw new Error(`Unable to parse initial state for contract: ${contractID}`);
        }
        
        // Load all the interaction txs relevant to this contract. 

        // This can be made a lot cleaner with some GraphQL features, 
        // (block info in results, pagination)
        // but for now, we stick with arql and use some utils to help 
        // with concurency and retry on errors. (we can be firing off thousands of requests here) 
        
        const arql = {
            op: 'and',
            expr1: {
                op: 'equals',
                expr1: 'App-Name',
                expr2: 'SmartWeave',
            },
            expr2: {
                op: 'equals',
                expr1: 'With-Contract',
                expr2: contractID
            }
        }
        
        let transactions = await arweave.arql(arql);
        console.log(`Query returned ${transactions.length} interactions`);

        const getTxInfoFn = retryWithBackoff(
            { tries: 2, startMs: 1000 }, 
            (id) => this.getFullTxInfo(arweave, id)
        );
        const batcher = batch(
            { batchDelayMs: 50, batchSize: 6 },
            softFailWith(null, getTxInfoFn)
        )
        let txInfos = await batcher(transactions);

        // Filter out txs that are not confirmed yet, not found, or are below the 
        // height we are replaying to.
        txInfos = txInfos.filter(x => !!x && x.info.confirmed.block_height <= height);
        // Sort
        console.log(`Replaying ${txInfos.length} to get current state`);
        txInfos.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

        for (let i = 0; i < txInfos.length; i++) {
            let input;
            
            try { 
                input = JSON.parse(this.getTag(txInfos[i].tx, 'Input'))
            } catch (e) {}

            if (!input) {
                console.warn(`Skipping tx with missing or invalid Input tag - ${txInfos[i].id}`);
                continue;
            }
            
            let nextState = await this.execute(contractInfo.contractSrc, input, state, txInfos[i].from);
            if (!nextState) {
                console.warn(`Executing of interaction: ${txInfos[i].id} threw exception, skipping`);
                continue;
            }

            state = nextState;
        }

        return state; 
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
        } catch (err) {
            console.error(err);
            return false
        }

        // Return the modified state
        return state
    },

    // Interaction that writes a state change. 
    interactWrite: async function(arweave, wallet, contractID, input) {

        // Workaround we set data to something 
        // otherwise tx will not be valid, since it has no data 
        // and no target. 
        let interactionTX = await arweave.createTransaction({
            data: Math.random().toString()
        }, wallet)

        interactionTX.addTag('App-Name', 'SmartWeave')
        interactionTX.addTag('Type', 'interaction')
        interactionTX.addTag('With-Contract', contractID)
        interactionTX.addTag('Version', '0.2.0')
        interactionTX.addTag('Input', JSON.stringify(input))

        await arweave.transactions.sign(interactionTX, wallet)

        const response = await arweave.transactions.post(interactionTX)

        if(response.status != 200)
            return false
        
        return interactionTX.id
    },

    interactWriteDryRun: async function(arweave, wallet, contractID, input) {
        const contractInfo = await this.getContract(arweave, contractID);
        const latestState = await this.replayToState(arweave, contractID);
        const result = await this.execute(contractInfo.contractSrc, input, latestState, await arweave.wallets.jwkToAddress(wallet)); 
        if (!result) {
            return {
                success: false 
            }
        }
        return {
            success: true,
            state: result
        }
    },

    // un-used
    validateStateTransition: async function(contractSrc, state, input, newState, caller) {
        return this.execute(contractSrc, input, state, caller) == newState
    },

    // un-used
    interact: async function(arweave, wallet, contractID, input, dryRun) {
        // Call a contract with new input, storing the resulting TX on-weave.
        // In order to execute this, the client first locates the top valid tip in the network,
        // executes the contract, and saves the new resulting contract.
        // Other clients can then pick-up this new state, validate the state transitions,
        // and add their own transactions to the top of the chain for the contract.
        const tipTX = await this.findContractTip(arweave, contractID)
        const contractTX = await arweave.transactions.get(contractID)
        const contractSrcTXID = this.getTag(contractTX, 'Contract-Src')
        const contractSrcTX = await arweave.transactions.get(contractSrcTXID)
        const contractSrc = contractSrcTX.get('data', {decode: true, string: true})

        state = this.getTXState(tipTX)
        const caller = await arweave.wallets.jwkToAddress(wallet)

        // Calcualte the state after our new TX has been processed.
        const newState = await this.execute(contractSrc, input, state, caller)

        if(!newState)
            return false

        // If we are in a dry-run, just return the new state and do not commit.
        if(dryRun)
            return newState

        // Package new state into new TX, add POW
        let interactionTX = await arweave.createTransaction({
            data: JSON.stringify({newState: newState, input: input})
        }, wallet)

        interactionTX.addTag('App-Name', 'SmartWeave')
        interactionTX.addTag('Type', 'interaction')
        interactionTX.addTag('With-Contract', contractID)
        interactionTX.addTag('Previous-TX', tipTX.id)
        interactionTX.addTag('Version', '0.2.0')

        await arweave.transactions.sign(interactionTX, wallet)

        const response = await arweave.transactions.post(interactionTX)

        if(response.status != 200)
            return false
        
        return interactionTX.id
    },

    // un-used
    findContractTip: async function(arweave, contractID) {
        const contract = await this.getContract(arweave, contractID)
        let current = contract.contractTX
        let state = this.getTXState(current)

        do {
            last = current
            current = await this.findNextTX(arweave, contract, state, current)
            state = this.getTXState(current)
        }
        while(current)

        return last
    },

    // un-used 
    findNextTX: async function(arweave, contract, state, currentTX) {
        let successorsQuery =
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
                        expr1: 'Previous-TX',
                        expr2: currentTX.id
                    }
            }
        const response = await arweave.api.post(`arql`, successorsQuery)
        const results = response.data

        let successors = (results == '') ? [] : results

        for(let i = 0; i < successors.length; i++) {
            let TX = await arweave.transactions.get(successors[i])
            if(this.validateNextTX(arweave, contract, state, TX))
                return TX
        }

        return false
    },

    // This gets the full Tx Info, and calcutes a sort key.
    // It needs to get the block_height and indep_hash from
    // the status endpoint as well as the tx itself. If the 
    // tx is confirmed it assigns it a sort key, otherwise it
    // does not. 
    getFullTxInfo: async function(arweave,id) {
        const [tx, info] = await Promise.all([
            arweave.transactions.get(id).catch(e => {
                if (e.type === 'TX_PENDING') {
                    return undefined
                } 
                throw(e);
            }),
            arweave.transactions.getStatus(id)
        ])

        if (!tx || !info.confirmed) {
            return undefined;
        }
        
        function arrayToHex(arr) {
            let str = ''
            for (let i = 0; i < arr.length; i++) {
                str += ("0"+arr[i].toString(16)).slice(-2)
            }
            return str;
        }

        // Construct a string that will lexographically sort.
        // { block_height, sha256(block_indep_hash + txid) }
        const blockHashBytes = arweave.utils.b64UrlToBuffer(info.confirmed.block_indep_hash)
        const txIdBytes = arweave.utils.b64UrlToBuffer(id)
        const concatted = arweave.utils.concatBuffers([blockHashBytes, txIdBytes])
        const hashed = arrayToHex(await arweave.crypto.hash(concatted))
        const block_height = `000000${info.confirmed.block_height}`.slice(-12); 
    
        const sortKey = `${block_height},${hashed}`
        
        return { tx, info, id: tx.id, sortKey, from: await arweave.wallets.ownerToAddress(tx.owner) }
    },

    validateNextTX: async function(arweave, contract, state, nextTX) {
        try {
            let struct = JSON.parse(nextTX.get('data', { decode: true, string: true }))

            return this.validateStateTransition(
                contract.contractSrc,
                state,
                struct.input,
                this.getTXState(nextTX),
                await arweave.wallets.ownerToAddress(nextTX.owner))
        } catch (err) {
            return false
        }
    },

    getContract: async function(arweave, contractID) {
        // Generate an object containing the details about a contract in one place.
        const contractTX = await arweave.transactions.get(contractID)
        const contractSrcTXID = this.getTag(contractTX, 'Contract-Src')
        const minDiff = this.getTag(contractTX, 'Min-Diff')
        const contractSrcTX = await arweave.transactions.get(contractSrcTXID)
        const contractSrc = contractSrcTX.get('data', {decode: true, string: true})
        const state = contractTX.get('data', {decode: true, string: true})

        return {
            id: contractID,
            contractSrc: contractSrc,
            initState: state,
            minDiff: minDiff,
            contractTX: contractTX
        }
    },

    // Helpers
    getTag: function(TX, name) {
        let tags = TX.get('tags')

        for(let i = 0; i < tags.length; i++)
            if(tags[i].get('name', { decode: true, string: true }) == name)
                return tags[i].get('value', { decode: true, string: true })

        return false
    },

    getTXState: function(TX) {
        if(!TX) return false
        if(this.getTag(TX, 'Type') == "contract")
            return TX.get('data', {decode: true, string: true})
        else
            return JSON.parse(TX.get('data', {decode: true, string: true}))['newState']
    }
 }
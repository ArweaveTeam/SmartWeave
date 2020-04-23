# SmartWeave
## Simple, scalable smart contracts on the Arweave protocol.

Uses lazy-evaluation to move the burden of contract execution from network nodes to smart contract users.

Transactions can be ANS-102 bundled data entries, allowing `2^256/(tx_size)` smart contract transactions to be written into the network at once. Subsequently, the core scalability limitation of the SmartWeave protocol is the speed at which users can find the top transaction for each contract, rather than network consensus speed. This limitation should decline linearly with hardware improvements in the future.

Currently, SmartWeave v0.0.1 supports JavaScript, using the client's unmodified execution engine.

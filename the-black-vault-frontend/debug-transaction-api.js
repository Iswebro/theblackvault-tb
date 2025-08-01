// debug-transaction-api.js - Debug version to check RPC connectivity
const BSC_RPC_URL = process.env.BSC_RPC_URL;

console.log('BSC_RPC_URL:', BSC_RPC_URL);

async function testRPC() {
  if (!BSC_RPC_URL) {
    console.error('BSC_RPC_URL is not set!');
    return;
  }

  try {
    console.log('Testing RPC connection...');
    const response = await fetch(BSC_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      })
    });

    const data = await response.json();
    const currentBlock = parseInt(data.result, 16);
    console.log('Current block number:', currentBlock);

    // Test getting a recent block
    const blockResponse = await fetch(BSC_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBlockByNumber',
        params: [data.result, false],
        id: 1
      })
    });

    const blockData = await blockResponse.json();
    const timestamp = parseInt(blockData.result.timestamp, 16);
    console.log('Current block timestamp:', new Date(timestamp * 1000).toISOString());

    // Test getting logs for Deposited event with correct signature
    const CONTRACT_ADDRESS = "0x22708D8a54c044CbA5B237620Af42030cbf76E14";
    const DEPOSITED_SIGNATURE = '0xc490a74c1058132dffb93944d555ddd1817ae53b7367ea1126ff123b1b1344a58';
    
    console.log('\\nTesting recent Deposited events...');
    const logsResponse = await fetch(BSC_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [{
          fromBlock: `0x${(currentBlock - 1000).toString(16)}`, // Last 1000 blocks
          toBlock: 'latest',
          address: CONTRACT_ADDRESS,
          topics: [DEPOSITED_SIGNATURE]
        }],
        id: 1
      })
    });

    const logsData = await logsResponse.json();
    console.log('Recent Deposited events found:', logsData.result ? logsData.result.length : 0);
    
    if (logsData.result && logsData.result.length > 0) {
      console.log('First few events:');
      logsData.result.slice(0, 3).forEach((log, index) => {
        console.log(`Event ${index + 1}:`, {
          blockNumber: parseInt(log.blockNumber, 16),
          transactionHash: log.transactionHash,
          topics: log.topics.length
        });
      });
    }

  } catch (error) {
    console.error('RPC test failed:', error.message);
  }
}

testRPC();

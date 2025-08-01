// test-ankr-direct.js - Direct Ankr API test
const ANKR_URL = "https://rpc.ankr.com/bsc/608da03fc0a1cb8d5a5a6df34cb8bc598dfa27f71213d822afb470aaf0018ee4";
const CONTRACT_ADDRESS = "0x22708D8a54c044CbA5B237620Af42030cbf76E14";
const YOUR_WALLET = "0x706961C676FE743C34A867437661D13E16ADCbEc";

async function testAnkrDirect() {
  try {
    console.log('🔍 Testing direct Ankr API...');
    
    // Get current block
    const blockResponse = await fetch(ANKR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      })
    });
    
    const blockData = await blockResponse.json();
    const currentBlock = parseInt(blockData.result, 16);
    console.log('📊 Current block:', currentBlock);
    
    // Search for ANY events from the contract in the last 5000 blocks
    const fromBlock = currentBlock - 5000;
    console.log(`🔍 Searching for any events from block ${fromBlock} to ${currentBlock}...`);
    
    const logsResponse = await fetch(ANKR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [{
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: 'latest',
          address: CONTRACT_ADDRESS
          // No topics filter - get ALL events
        }],
        id: 1
      })
    });
    
    const logsData = await logsResponse.json();
    
    if (logsData.error) {
      console.error('❌ RPC Error:', logsData.error);
      return;
    }
    
    const allEvents = logsData.result || [];
    console.log(`📋 Found ${allEvents.length} total events from contract in last 5000 blocks`);
    
    if (allEvents.length > 0) {
      console.log('\n📝 Recent events:');
      allEvents.slice(-10).forEach((event, i) => {
        console.log(`Event ${i + 1}:`);
        console.log(`  Block: ${parseInt(event.blockNumber, 16)}`);
        console.log(`  Tx: ${event.transactionHash}`);
        console.log(`  Topic0: ${event.topics[0]}`);
        console.log(`  Topics count: ${event.topics.length}`);
        console.log('');
      });
      
      // Check if any events involve your wallet
      const yourEvents = allEvents.filter(event => 
        event.topics.some(topic => 
          topic.toLowerCase().includes(YOUR_WALLET.toLowerCase().slice(2))
        )
      );
      
      console.log(`🎯 Events involving your wallet: ${yourEvents.length}`);
      if (yourEvents.length > 0) {
        console.log('Your recent events:');
        yourEvents.slice(-5).forEach((event, i) => {
          console.log(`  ${i + 1}. Block ${parseInt(event.blockNumber, 16)}: ${event.transactionHash}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAnkrDirect();

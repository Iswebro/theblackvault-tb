// test-your-transaction.js - Test your specific transaction
const ANKR_URL = "https://rpc.ankr.com/bsc/608da03fc0a1cb8d5a5a6df34cb8bc598dfa27f71213d822afb470aaf0018ee4";
const YOUR_TX = "0x57608fd611231a158333ce511bdfdf7094b9a2d674a1b285e8007cb9702ff393";
const YOUR_WALLET = "0x706961C676FE743C34A867437661D13E16ADCbEc";

async function testYourTransaction() {
  try {
    console.log('🔍 Getting your transaction details...');
    
    const response = await fetch(ANKR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [YOUR_TX],
        id: 1
      })
    });
    
    const data = await response.json();
    const receipt = data.result;
    
    console.log('📄 Transaction Receipt:');
    console.log('  Block:', parseInt(receipt.blockNumber, 16));
    console.log('  Status:', receipt.status);
    console.log('  Logs:', receipt.logs.length);
    
    receipt.logs.forEach((log, i) => {
      console.log(`\nLog ${i + 1}:`);
      console.log('  Address:', log.address);
      console.log('  Topic0:', log.topics[0]);
      console.log('  Topics:', log.topics.length);
      console.log('  Data length:', log.data.length);
      
      // Check if this is the ReferralRewardsWithdrawn event
      if (log.topics[0] === '0x996ae2281234577779bb0d7cd6daa18e54006fe2f6dc172f12197d8266b08dabcd') {
        console.log('  ✅ This is ReferralRewardsWithdrawn event!');
        
        // Decode the user address from topics[1]
        const userFromTopic = '0x' + log.topics[1].slice(26);
        console.log('  User from topics[1]:', userFromTopic);
        console.log('  Your wallet:', YOUR_WALLET);
        console.log('  Addresses match:', userFromTopic.toLowerCase() === YOUR_WALLET.toLowerCase());
        
        // Decode amount from data
        const amount = parseInt(log.data.slice(0, 66), 16);
        console.log('  Amount (wei):', amount);
        console.log('  Amount (USDT):', (amount / 1e6).toFixed(6));
      }
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testYourTransaction();

const { ethers } = require('ethers');

const CONTRACT_ADDRESS = '0x22708D8a54c044CbA5B237620Af42030cbf76E14';
const YOUR_WALLET = '0xdeE2027D2d42f11822f8BF448eD9e41556F360b3';
const DEFAULT_REFERRER = '0x706961C676FE743C34A867437661D13E16ADCbEc';

const ABI = [
  'event Deposited(address indexed user, uint256 amount, address indexed referrer, uint256 cycle)',
  'event DepositWithReferrer(address indexed user, uint256 amount, address indexed referrer)'
];

async function checkYourDeposits() {
  try {
    console.log('🔍 Checking your deposit history...');
    console.log('Your Wallet:', YOUR_WALLET);
    
    const provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    
    // Get your deposit events
    const depositFilter = contract.filters.Deposited(YOUR_WALLET);
    const depositWithRefFilter = contract.filters.DepositWithReferrer(YOUR_WALLET);
    
    console.log('\n📋 Fetching your deposit events...');
    
    const depositEvents = await contract.queryFilter(depositFilter, -20000);
    const depositWithRefEvents = await contract.queryFilter(depositWithRefFilter, -20000);
    
    const allEvents = [...depositEvents, ...depositWithRefEvents];
    console.log(`Found ${allEvents.length} total deposit events for your wallet\n`);
    
    if (allEvents.length > 0) {
      // Sort by block number
      allEvents.sort((a, b) => a.blockNumber - b.blockNumber);
      
      console.log('📋 YOUR DEPOSIT HISTORY (chronological order):');
      console.log('='.repeat(70));
      
      allEvents.forEach((event, index) => {
        const eventType = event.fragment?.name || 'Unknown';
        const referrer = event.args.referrer;
        const amount = ethers.formatEther(event.args.amount);
        const isDefaultReferrer = referrer.toLowerCase() === DEFAULT_REFERRER.toLowerCase();
        const isZeroAddress = referrer === ethers.ZeroAddress || referrer === '0x0000000000000000000000000000000000000000';
        
        console.log(`Deposit #${index + 1}:`);
        console.log(`   Event: ${eventType}`);
        console.log(`   Amount: ${amount} USDT`);
        console.log(`   Referrer: ${referrer}`);
        
        if (isZeroAddress) {
          console.log(`   🔴 NO REFERRAL (Zero Address) → Should give bonus to DEFAULT REFERRER`);
        } else if (isDefaultReferrer) {
          console.log(`   🟡 USED DEFAULT REFERRER → Should give bonus to DEFAULT REFERRER`);
        } else {
          console.log(`   🟢 USED CUSTOM REFERRER → Should give bonus to CUSTOM REFERRER`);
        }
        
        console.log(`   Block: ${event.blockNumber}`);
        console.log(`   TX: ${event.transactionHash}`);
        console.log('');
      });
      
      // Count deposits that should have given bonuses to default referrer
      const defaultReferrerDeposits = allEvents.filter(event => {
        const referrer = event.args.referrer;
        return referrer.toLowerCase() === DEFAULT_REFERRER.toLowerCase() || 
               referrer === ethers.ZeroAddress || 
               referrer === '0x0000000000000000000000000000000000000000';
      });
      
      console.log('🎯 SUMMARY:');
      console.log(`   Total deposits: ${allEvents.length}`);
      console.log(`   Deposits that should give bonuses to default referrer: ${defaultReferrerDeposits.length}`);
      console.log(`   Contract says you've used: 3 bonuses`);
      console.log(`   Expected: Only first 3 deposits should give bonuses`);
      
      if (defaultReferrerDeposits.length > 3) {
        console.log(`   🚨 BUG: You made ${defaultReferrerDeposits.length} deposits but only 3 should give bonuses!`);
      }
      
    } else {
      console.log('No deposit events found for your wallet');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkYourDeposits();

// Debug the aggregation function directly
import { ethers } from "ethers";

export default async function handler(req, res) {
  try {
    console.log('🔍 DEBUGGING: Testing blockchain connection and event detection...');
    
    // Test blockchain connection
    const provider = new ethers.JsonRpcProvider('https://bsc-dataseed1.binance.org/');
    const contractAddress = "0x5C7aC1DBe2eE75953f7b4dd1F31625E244A4AD6d";
    
    // Test basic contract connection
    const currentBlock = await provider.getBlockNumber();
    console.log('Current block:', currentBlock);
    
    // Basic ABI with both event types
    const testABI = [
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: "address", name: "user", type: "address" },
          { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
          { indexed: true, internalType: "address", name: "referrer", type: "address" },
          { indexed: false, internalType: "uint256", name: "cycle", type: "uint256" }
        ],
        name: "Deposited",
        type: "event"
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: "address", name: "user", type: "address" },
          { indexed: true, internalType: "address", name: "referrer", type: "address" },
          { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
          { indexed: false, internalType: "uint256", name: "cycle", type: "uint256" }
        ],
        name: "Deposit",
        type: "event"
      }
    ];
    
    const contract = new ethers.Contract(contractAddress, testABI, provider);
    
    // Calculate date ranges
    const COMPETITION_LAUNCH_TIMESTAMP = 1755118800; // Aug 14, 2025 07:00 AEST
    const PROJECT_LAUNCH_TIMESTAMP = 1723500000; // Aug 12, 2024 22:46 AEST (estimated)
    const WEEK_DURATION = 7 * 24 * 60 * 60;
    
    // Test recent blocks first (last 1000 blocks)
    const recentFromBlock = Math.max(currentBlock - 1000, 0);
    console.log(`Testing recent blocks: ${recentFromBlock} to ${currentBlock}`);
    
    // Try both event types on recent blocks
    let recentDeposited = [];
    let recentDeposit = [];
    
    try {
      recentDeposited = await contract.queryFilter("Deposited", recentFromBlock, currentBlock);
      console.log(`✅ Found ${recentDeposited.length} "Deposited" events in recent blocks`);
    } catch (error) {
      console.log(`❌ "Deposited" events failed:`, error.message);
    }
    
    try {
      recentDeposit = await contract.queryFilter("Deposit", recentFromBlock, currentBlock);
      console.log(`✅ Found ${recentDeposit.length} "Deposit" events in recent blocks`);
    } catch (error) {
      console.log(`❌ "Deposit" events failed:`, error.message);
    }
    
    // Test project timeframe (from project launch)
    const projectLaunchBlock = await provider.getBlock(PROJECT_LAUNCH_TIMESTAMP);
    console.log(`Project launch block estimate: ${projectLaunchBlock?.number || 'unknown'}`);
    
    // Try a smaller range from competition start
    const competitionStartBlock = Math.floor((COMPETITION_LAUNCH_TIMESTAMP - PROJECT_LAUNCH_TIMESTAMP) / 3) + (projectLaunchBlock?.number || 30000000);
    const testFromBlock = Math.max(competitionStartBlock, currentBlock - 10000);
    const testToBlock = Math.min(testFromBlock + 5000, currentBlock);
    
    console.log(`Testing competition range: ${testFromBlock} to ${testToBlock}`);
    
    let competitionDeposited = [];
    let competitionDeposit = [];
    
    try {
      competitionDeposited = await contract.queryFilter("Deposited", testFromBlock, testToBlock);
      console.log(`✅ Found ${competitionDeposited.length} "Deposited" events in competition range`);
    } catch (error) {
      console.log(`❌ "Deposited" events in competition range failed:`, error.message);
    }
    
    try {
      competitionDeposit = await contract.queryFilter("Deposit", testFromBlock, testToBlock);
      console.log(`✅ Found ${competitionDeposit.length} "Deposit" events in competition range`);
    } catch (error) {
      console.log(`❌ "Deposit" events in competition range failed:`, error.message);
    }
    
    // Check for any events with non-zero referrer
    const allEvents = [...recentDeposited, ...recentDeposit, ...competitionDeposited, ...competitionDeposit];
    const eventsWithReferrer = allEvents.filter(event => {
      const referrer = event.args?.referrer || event.args?.[1] || event.args?.[2];
      return referrer && referrer !== ethers.ZeroAddress;
    });
    
    console.log(`Total events found: ${allEvents.length}`);
    console.log(`Events with non-zero referrer: ${eventsWithReferrer.length}`);
    
    // Show sample events
    const sampleEvents = eventsWithReferrer.slice(0, 3).map(event => ({
      event: event.eventName || event.fragment?.name,
      user: event.args?.user || event.args?.[0],
      referrer: event.args?.referrer || event.args?.[1] || event.args?.[2],
      amount: event.args?.amount ? ethers.formatEther(event.args.amount) : 'unknown',
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash
    }));
    
    return res.status(200).json({
      success: true,
      blockchain: {
        currentBlock,
        provider: 'BSC Mainnet',
        contractAddress
      },
      testing: {
        recentBlocks: {
          range: `${recentFromBlock}-${currentBlock}`,
          depositedEvents: recentDeposited.length,
          depositEvents: recentDeposit.length
        },
        competitionRange: {
          range: `${testFromBlock}-${testToBlock}`,
          depositedEvents: competitionDeposited.length,
          depositEvents: competitionDeposit.length
        }
      },
      analysis: {
        totalEventsFound: allEvents.length,
        eventsWithReferrer: eventsWithReferrer.length,
        sampleEvents: sampleEvents
      },
      timestamps: {
        competitionLaunch: COMPETITION_LAUNCH_TIMESTAMP,
        competitionLaunchDate: new Date(COMPETITION_LAUNCH_TIMESTAMP * 1000).toISOString(),
        projectLaunch: PROJECT_LAUNCH_TIMESTAMP,
        projectLaunchDate: new Date(PROJECT_LAUNCH_TIMESTAMP * 1000).toISOString(),
        now: Math.floor(Date.now() / 1000),
        nowDate: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Debug test failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}

// Test very small block ranges to find what works
import { ethers } from "ethers";

export default async function handler(req, res) {
  try {
    console.log('🧪 Testing minimal block ranges...');
    
    const provider = new ethers.JsonRpcProvider('https://bsc-dataseed1.binance.org/');
    const contractAddress = "0x22708D8a54c044CbA5B237620Af42030cbf76E14";
    
    const depositedABI = [{
      anonymous: false,
      inputs: [
        { indexed: true, internalType: "address", name: "user", type: "address" },
        { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
        { indexed: true, internalType: "address", name: "referrer", type: "address" },
        { indexed: false, internalType: "uint256", name: "cycle", type: "uint256" }
      ],
      name: "Deposited",
      type: "event"
    }];
    
    const contract = new ethers.Contract(contractAddress, depositedABI, provider);
    const currentBlock = await provider.getBlockNumber();
    
    // Test progressively smaller ranges
    const testRanges = [100, 50, 25, 10, 5, 1];
    const results = {};
    
    for (const range of testRanges) {
      const fromBlock = currentBlock - range;
      try {
        console.log(`Testing range ${range} blocks: ${fromBlock} to ${currentBlock}`);
        const events = await contract.queryFilter("Deposited", fromBlock, currentBlock);
        results[range] = {
          success: true,
          events: events.length,
          range: `${fromBlock}-${currentBlock}`
        };
        console.log(`✅ Range ${range}: ${events.length} events found`);
        
        // If this range works, try to get some sample data
        if (events.length > 0) {
          results[range].sampleEvents = events.slice(0, 2).map(event => ({
            user: event.args.user,
            referrer: event.args.referrer,
            amount: ethers.formatEther(event.args.amount),
            blockNumber: event.blockNumber
          }));
        }
        
      } catch (error) {
        results[range] = {
          success: false,
          error: error.message,
          range: `${fromBlock}-${currentBlock}`
        };
        console.log(`❌ Range ${range}: ${error.message}`);
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Find the largest working range
    const workingRanges = Object.entries(results).filter(([_, data]) => data.success);
    const maxWorkingRange = workingRanges.length > 0 ? 
      Math.max(...workingRanges.map(([range, _]) => parseInt(range))) : 0;
    
    return res.status(200).json({
      success: true,
      currentBlock,
      testResults: results,
      analysis: {
        maxWorkingRange,
        workingRanges: workingRanges.map(([range, _]) => parseInt(range)),
        recommendation: maxWorkingRange > 0 ? 
          `Use chunk size of ${Math.min(maxWorkingRange, 100)} blocks` : 
          'All ranges failed - RPC may be completely blocked'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Block range test failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}

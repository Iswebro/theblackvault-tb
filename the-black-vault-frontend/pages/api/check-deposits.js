// Check for ANY deposits, with or without referrers
import { ethers } from "ethers";

export default async function handler(req, res) {
  try {
    console.log('🔍 CHECKING: All deposits regardless of referrer...');
    
    const provider = new ethers.JsonRpcProvider('https://bsc-dataseed1.binance.org/');
    const contractAddress = "0x5C7aC1DBe2eE75953f7b4dd1F31625E244A4AD6d";
    
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
    
    // Check recent blocks (last 10000 blocks - about 8 hours on BSC)
    const fromBlock = Math.max(currentBlock - 10000, 0);
    console.log(`Checking blocks ${fromBlock} to ${currentBlock}`);
    
    const allDeposits = await contract.queryFilter("Deposited", fromBlock, currentBlock);
    console.log(`Found ${allDeposits.length} total deposits in recent blocks`);
    
    // Analyze the deposits
    const depositsWithReferrer = allDeposits.filter(event => {
      const referrer = event.args.referrer;
      return referrer && referrer !== ethers.ZeroAddress;
    });
    
    const depositsWithoutReferrer = allDeposits.filter(event => {
      const referrer = event.args.referrer;
      return !referrer || referrer === ethers.ZeroAddress;
    });
    
    console.log(`Deposits with referrer: ${depositsWithReferrer.length}`);
    console.log(`Deposits without referrer: ${depositsWithoutReferrer.length}`);
    
    // Show sample deposits
    const sampleDeposits = allDeposits.slice(0, 5).map(event => ({
      user: event.args.user,
      amount: ethers.formatEther(event.args.amount),
      referrer: event.args.referrer,
      cycle: event.args.cycle.toString(),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      hasReferrer: event.args.referrer !== ethers.ZeroAddress
    }));
    
    // Check specific target user
    const targetUser = '0xB98e82C611BFc1b852412268fd300E28fAEE4D48';
    const targetDeposits = allDeposits.filter(event => 
      event.args.user.toLowerCase() === targetUser.toLowerCase()
    );
    
    const targetAsReferrer = allDeposits.filter(event => 
      event.args.referrer.toLowerCase() === targetUser.toLowerCase()
    );
    
    // If no recent deposits, check older blocks
    let olderDeposits = [];
    if (allDeposits.length === 0) {
      console.log('No recent deposits found, checking older blocks...');
      const olderFromBlock = Math.max(currentBlock - 100000, 0); // ~3 days on BSC
      try {
        olderDeposits = await contract.queryFilter("Deposited", olderFromBlock, fromBlock);
        console.log(`Found ${olderDeposits.length} deposits in older range ${olderFromBlock}-${fromBlock}`);
      } catch (error) {
        console.log('Error checking older blocks:', error.message);
      }
    }
    
    return res.status(200).json({
      success: true,
      blockRange: {
        from: fromBlock,
        to: currentBlock,
        totalBlocks: currentBlock - fromBlock
      },
      deposits: {
        total: allDeposits.length,
        withReferrer: depositsWithReferrer.length,
        withoutReferrer: depositsWithoutReferrer.length,
        olderDeposits: olderDeposits.length
      },
      targetUser: {
        address: targetUser,
        depositsAsUser: targetDeposits.length,
        depositsAsReferrer: targetAsReferrer.length
      },
      sampleDeposits: sampleDeposits,
      analysis: {
        contractActive: allDeposits.length > 0,
        referralsActive: depositsWithReferrer.length > 0,
        needsOlderDataCheck: allDeposits.length === 0
      }
    });
    
  } catch (error) {
    console.error('❌ Deposit check failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}

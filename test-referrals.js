const { ethers } = require("ethers");

const RPC_URL = "https://rpc.ankr.com/bsc/d074aa9b547a0e06b9e9b1bb3c78f25b6a9cf86b24c96f13b67bccb42c19fa22";
const CONTRACT_ADDRESS = "0x22708D8a54c044CbA5B237620Af42030cbf76E14";
const BLACK_VAULT_ABI = [
  "event Deposited(address indexed user, uint256 amount, address indexed referrer, uint256 cycle)",
  "function getUserReferralData(address user) view returns (uint256 totalRewards, uint256 availableRewards, uint256 referredCount, uint256 totalVolume, uint256 totalWithdrawn)"
];

async function test() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, BLACK_VAULT_ABI, provider);
    
    const account = "0xdeE2027D2d42f11822f8BF448eD9e41556F360b3";
    
    console.log("Testing contract data for:", account);
    
    // Get user referral data
    const referralData = await contract.getUserReferralData(account);
    console.log("Contract data:");
    console.log("- Total rewards:", ethers.formatEther(referralData[0]));
    console.log("- Available rewards:", ethers.formatEther(referralData[1]));  
    console.log("- Referred count:", referralData[2].toString());
    console.log("- Total volume:", ethers.formatEther(referralData[3]));
    console.log("- Total withdrawn:", ethers.formatEther(referralData[4]));
    
    // Try to get some deposit events
    const currentBlock = await provider.getBlockNumber();
    console.log("Current block:", currentBlock);
    
    const depositFilter = contract.filters.Deposited(null, null, account);
    console.log("Trying to get deposit events where referrer =", account);
    
    // Try with smaller block range first
    const events = await contract.queryFilter(depositFilter, -5000);
    console.log("Found", events.length, "deposit events in last 5000 blocks");
    
    if (events.length > 0) {
      console.log("Sample event:", {
        user: events[0].args.user,
        amount: ethers.formatEther(events[0].args.amount),
        referrer: events[0].args.referrer,
        cycle: events[0].args.cycle.toString()
      });
    }
    
  } catch (error) {
    console.error("Test failed:", error.message);
  }
}

test();

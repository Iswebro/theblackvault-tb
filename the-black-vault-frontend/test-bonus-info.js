// Test script to check actual bonus info from contract
const { ethers } = require('ethers');

const RPC_URL = 'https://rpc.ankr.com/bsc/608da03fc0a1cb8d5a5a6df34cb8bc598dfa27f71213d822afb470aaf0018ee4';
const CONTRACT_ADDRESS = '0x22708D8a54c044CbA5B237620Af42030cbf76E14';
const DEFAULT_REFERRER = '0x706961C676FE743C34A867437661D13E16ADCbEc';
const YOUR_WALLET = '0xdee2027d2d42f11822f8bf448ed9e41556f360b3';

const BLACK_VAULT_ABI = [
  "function getReferralBonusInfo(address referrer, address referee) view returns (uint256 used, uint256 remaining)",
  "function getUserReferralData(address user) view returns (uint256 totalRewards, uint256 availableRewards, uint256 referredCount, uint256 totalVolume, uint256 totalWithdrawn)"
];

async function checkBonusInfo() {
  try {
    console.log("🔍 Connecting to BSC contract...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, BLACK_VAULT_ABI, provider);
    
    console.log("📋 Testing bonus info for your wallet:", YOUR_WALLET);
    console.log("📋 Default referrer:", DEFAULT_REFERRER);
    
    // Check bonus info between default referrer and your wallet
    const bonusInfo = await contract.getReferralBonusInfo(DEFAULT_REFERRER, YOUR_WALLET);
    console.log("\n🎯 LIVE CONTRACT DATA:");
    console.log("  Bonuses Used:", bonusInfo.used.toString());
    console.log("  Bonuses Remaining:", bonusInfo.remaining.toString());
    console.log("  Total Possible:", parseInt(bonusInfo.used) + parseInt(bonusInfo.remaining));
    
    // Also check your wallet's referral data (as a referrer)
    console.log("\n📊 Your wallet as referrer:");
    const yourReferralData = await contract.getUserReferralData(YOUR_WALLET);
    console.log("  Total Rewards:", ethers.formatEther(yourReferralData[0]), "BNB");
    console.log("  Available Rewards:", ethers.formatEther(yourReferralData[1]), "BNB");
    console.log("  People You Referred:", yourReferralData[2].toString());
    console.log("  Total Volume:", ethers.formatEther(yourReferralData[3]), "BNB");
    console.log("  Total Withdrawn:", ethers.formatEther(yourReferralData[4]), "BNB");
    
    // Check default referrer's data
    console.log("\n📊 Default referrer data:");
    const defaultReferralData = await contract.getUserReferralData(DEFAULT_REFERRER);
    console.log("  Total Rewards:", ethers.formatEther(defaultReferralData[0]), "BNB");
    console.log("  Available Rewards:", ethers.formatEther(defaultReferralData[1]), "BNB");
    console.log("  People Referred:", defaultReferralData[2].toString());
    console.log("  Total Volume:", ethers.formatEther(defaultReferralData[3]), "BNB");
    console.log("  Total Withdrawn:", ethers.formatEther(defaultReferralData[4]), "BNB");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkBonusInfo();

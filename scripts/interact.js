// scripts/interact.js
const hre = require("hardhat");

async function main() {
  const [user, referrer] = await hre.ethers.getSigners(); // use first two accounts
  const vault = await hre.ethers.getContractAt("BlackVault", "0x5FbDB2315678afecb367f032d93F642f64180aa3");

  console.log("💰 Depositing 1 ETH from user...");
  const tx = await vault.connect(user).deposit(referrer.address, { value: hre.ethers.parseEther("1") });
  await tx.wait();

  console.log("✅ Deposit successful!");

  // Optional: check referral rewards
  const referralRewards = await vault.referralRewards(referrer.address);
  console.log("🎁 Referral rewards:", hre.ethers.formatEther(referralRewards), "ETH");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

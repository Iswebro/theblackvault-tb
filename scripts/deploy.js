// scripts/deploy.js

const hre = require("hardhat");

async function main() {
  const BlackVault = await hre.ethers.getContractFactory("BlackVault");
  const vault = await BlackVault.deploy();
  await vault.waitForDeployment();
  console.log("✅ BlackVault deployed to:", await vault.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

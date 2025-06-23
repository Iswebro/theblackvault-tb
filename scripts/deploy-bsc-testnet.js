const hre = require("hardhat")

async function main() {
  console.log("🚀 Deploying BlackVault USDT Staking to BSC Testnet...")

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners()
  console.log("📝 Deploying with account:", deployer.address)

  // Check BNB balance for gas
  const balance = await deployer.provider.getBalance(deployer.address)
  console.log("💰 BNB balance for gas:", hre.ethers.formatEther(balance), "BNB")

  if (balance === 0n) {
    console.log("❌ No BNB balance for gas! Get testnet BNB from: https://testnet.binance.org/faucet-smart")
    return
  }

  // USDT contract addresses
  const USDT_ADDRESSES = {
    // BSC Testnet - you can use a mock USDT or deploy your own
    testnet: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd", // Mock USDT on testnet
    // BSC Mainnet
    mainnet: "0x55d398326f99059fF775485246999027B3197955", // Real USDT on mainnet
  }

  const usdtAddress = USDT_ADDRESSES.testnet
  console.log("📍 Using USDT address:", usdtAddress)

  // Deploy the contract
  console.log("⏳ Deploying BlackVault contract...")
  const BlackVault = await hre.ethers.getContractFactory("BlackVault")
  const blackVault = await BlackVault.deploy(usdtAddress)

  await blackVault.waitForDeployment()
  const contractAddress = await blackVault.getAddress()

  console.log("✅ BlackVault deployed successfully!")
  console.log("📍 Contract Address:", contractAddress)
  console.log("🔗 View on BSCScan:", `https://testnet.bscscan.com/address/${contractAddress}`)

  // Test contract functions
  console.log("\n🧪 Testing contract functions...")
  try {
    const dailyRate = await blackVault.DAILY_RATE()
    const maxWithdrawal = await blackVault.MAX_WITHDRAWAL_PER_CYCLE()
    const minDeposit = await blackVault.MIN_DEPOSIT()
    const isPaused = await blackVault.paused()
    const usdtAddr = await blackVault.getUSDTAddress()

    console.log("📊 Daily Rate:", dailyRate.toString(), "(2.2%)")
    console.log("💸 Max Withdrawal:", hre.ethers.formatEther(maxWithdrawal), "USDT")
    console.log("💰 Min Deposit:", hre.ethers.formatEther(minDeposit), "USDT")
    console.log("⏸️  Paused:", isPaused)
    console.log("🪙 USDT Address:", usdtAddr)
  } catch (error) {
    console.log("⚠️  Could not read contract data:", error.message)
  }

  // Verify contract on BSCScan
  if (process.env.BSCSCAN_API_KEY) {
    console.log("\n⏳ Waiting for block confirmations before verification...")
    await blackVault.deploymentTransaction().wait(5)

    try {
      console.log("🔍 Verifying contract on BSCScan...")
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [usdtAddress],
      })
      console.log("✅ Contract verified on BSCScan!")
    } catch (error) {
      console.log("❌ Verification failed:", error.message)
    }
  }

  // Save deployment info
  const deploymentInfo = {
    network: "BSC Testnet",
    contractAddress: contractAddress,
    usdtAddress: usdtAddress,
    deployer: deployer.address,
    blockExplorer: `https://testnet.bscscan.com/address/${contractAddress}`,
    dailyRate: "2.2%",
    maxWithdrawal: "250 USDT",
    minDeposit: "50 USDT",
    timestamp: new Date().toISOString(),
  }

  console.log("\n📋 Deployment Summary:")
  console.log(JSON.stringify(deploymentInfo, null, 2))

  console.log("\n🎉 Deployment Complete!")
  console.log("🔄 Next steps:")
  console.log("1. Update your .env file with:")
  console.log(`   REACT_APP_CONTRACT_ADDRESS=${contractAddress}`)
  console.log("2. Get some testnet USDT for testing")
  console.log("3. Restart your React app: npm start")
  console.log("4. Test USDT deposits and withdrawals!")

  console.log("\n💡 Important Notes:")
  console.log("- Users need to APPROVE USDT spending before depositing")
  console.log("- Minimum deposit: 50 USDT")
  console.log("- Maximum deposit: 100,000 USDT")
  console.log("- Daily rewards: 2.2% of deposited amount")
  console.log("- Referral bonus: 10% of referred deposits")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Deployment failed:", error)
    process.exit(1)
  })

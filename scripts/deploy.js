const hre = require("hardhat")

async function main() {
  console.log("🚀 Deploying BlackVault to BSC Mainnet...")

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners()
  console.log("📝 Deploying with account:", deployer.address)

  // Check BNB balance for gas
  const balance = await deployer.provider.getBalance(deployer.address)
  console.log("💰 BNB balance for gas:", hre.ethers.formatEther(balance), "BNB")

  if (balance === 0n) {
    console.log("❌ No BNB balance for gas!")
    return
  }

  // BSC Mainnet USDT address and Fee Wallet
  const usdtAddress = "0x55d398326f99059fF775485246999027B3197955"
  const feeWallet = "0x706961C676FE743C34A867437661D13E16ADCbEc"
  console.log("📍 Using USDT address:", usdtAddress)
  console.log("💰 Using Fee Wallet:", feeWallet)

  // Deploy the contract
  console.log("⏳ Deploying BlackVault contract...")
  const BlackVault = await hre.ethers.getContractFactory("BlackVault")
  const blackVault = await BlackVault.deploy(usdtAddress, feeWallet)

  await blackVault.waitForDeployment()
  const contractAddress = await blackVault.getAddress()

  console.log("✅ BlackVault deployed successfully!")
  console.log("📍 Contract Address:", contractAddress)
  console.log("🔗 View on BSCScan:", `https://bscscan.com/address/${contractAddress}`)

  // Test contract functions
  console.log("\n🧪 Testing contract functions...")
  try {
    const dailyRate = await blackVault.DAILY_RATE()
    const maxWithdrawal = await blackVault.MAX_WITHDRAWAL_PER_CYCLE()
    const minDeposit = await blackVault.MIN_DEPOSIT()
    const isPaused = await blackVault.paused()
    const usdtAddr = await blackVault.getUSDTAddress()
    const feeWalletAddr = await blackVault.feeWallet()

    console.log("📊 Daily Rate:", dailyRate.toString(), "(2.5%)")
    console.log("💸 Max Withdrawal:", hre.ethers.formatEther(maxWithdrawal), "USDT")
    console.log("💰 Min Deposit:", hre.ethers.formatEther(minDeposit), "USDT")
    console.log("⏸️  Paused:", isPaused)
    console.log("🪙 USDT Address:", usdtAddr)
    console.log("💳 Fee Wallet:", feeWalletAddr)
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
        constructorArguments: [usdtAddress, feeWallet],
      })
      console.log("✅ Contract verified on BSCScan!")
    } catch (error) {
      console.log("❌ Verification failed:", error.message)
    }
  }

  // Save deployment info
  const deploymentInfo = {
    network: "BSC Mainnet",
    contractAddress: contractAddress,
    usdtAddress: usdtAddress,
    feeWallet: feeWallet,
    deployer: deployer.address,
    blockExplorer: `https://bscscan.com/address/${contractAddress}`,
    dailyRate: "2.5%",
    maxWithdrawal: "250 USDT",
    minDeposit: "50 USDT",
    depositFee: "1%",
    timestamp: new Date().toISOString(),
  }

  console.log("\n📋 Deployment Summary:")
  console.log(JSON.stringify(deploymentInfo, null, 2))

  console.log("\n🎉 Deployment Complete!")
  console.log("🔄 Next steps:")
  console.log("1. Update your .env file with:")
  console.log(`   REACT_APP_CONTRACT_ADDRESS=${contractAddress}`)
  console.log(`   NEXT_PUBLIC_CONTRACT_ADDRESS=${contractAddress}`)
  console.log("2. Update your frontend configuration")
  console.log("3. Deploy your frontend to production")
  console.log("4. Test with small amounts first!")

  console.log("\n💡 Important Notes:")
  console.log("- This is MAINNET - real money!")
  console.log("- 1% deposit fee goes to:", feeWallet)
  console.log("- Users need real USDT to interact")
  console.log("- Test thoroughly before announcing")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Deployment failed:", error)
    process.exit(1)
  })

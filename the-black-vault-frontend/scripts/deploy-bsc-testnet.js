const hre = require("hardhat")

async function main() {
  console.log("Deploying to BSC Testnet...")

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners()
  console.log("Deploying with account:", deployer.address)

  // Check balance
  const balance = await deployer.provider.getBalance(deployer.address)
  console.log("Account balance:", hre.ethers.formatEther(balance), "BNB")

  if (balance === 0n) {
    console.log("❌ No BNB balance! Get testnet BNB from: https://testnet.binance.org/faucet-smart")
    return
  }

  // Deploy the contract
  const BlackVault = await hre.ethers.getContractFactory("BlackVault")

  // Constructor parameters (adjust these based on your contract)
  const dailyRate = 100 // 1% daily rate (in basis points)
  const cycleDuration = 86400 // 24 hours in seconds
  const maxWithdrawal = hre.ethers.parseEther("10") // 10 BNB max withdrawal

  console.log("Deploying BlackVault contract...")
  const blackVault = await BlackVault.deploy(dailyRate, cycleDuration, maxWithdrawal)

  await blackVault.waitForDeployment()
  const contractAddress = await blackVault.getAddress()

  console.log("✅ BlackVault deployed to:", contractAddress)
  console.log("🔗 View on BSCScan:", `https://testnet.bscscan.com/address/${contractAddress}`)

  // Verify contract (optional)
  if (process.env.BSCSCAN_API_KEY) {
    console.log("Waiting for block confirmations...")
    await blackVault.deploymentTransaction().wait(5)

    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [dailyRate, cycleDuration, maxWithdrawal],
      })
      console.log("✅ Contract verified on BSCScan")
    } catch (error) {
      console.log("❌ Verification failed:", error.message)
    }
  }

  // Save deployment info
  const deploymentInfo = {
    network: "BSC Testnet",
    contractAddress: contractAddress,
    deployer: deployer.address,
    blockExplorer: `https://testnet.bscscan.com/address/${contractAddress}`,
    timestamp: new Date().toISOString(),
  }

  console.log("\n📋 Deployment Summary:")
  console.log(JSON.stringify(deploymentInfo, null, 2))

  console.log("\n🚀 Next steps:")
  console.log("1. Update your .env file with:")
  console.log(`   REACT_APP_CONTRACT_ADDRESS=${contractAddress}`)
  console.log("2. Add BSC Testnet to your wallet")
  console.log("3. Test the dApp!")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

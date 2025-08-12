// Network configuration

// Hardcoded config for BSC Mainnet (or Testnet if you wish)
export const config = {
  // Contract settings
  contractAddress: "0x22708D8a54c044CbA5B237620Af42030cbf76E14", // <-- set to your deployed contract address
  usdtAddress:     "0x55d398326f99059fF775485246999027B3197955", // <-- set to your USDT token address
  defaultReferrer: "0x706961C676FE743C34A867437661D13E16ADCbEc", // <-- default referrer when no referral is provided

  // Network settings
  chainId: 56, // 56 for BSC Mainnet, 97 for Testnet
  chainName: "Binance Smart Chain Mainnet",
  rpcUrl: "https://rpc.ankr.com/multichain/608da03fc0a1cb8d5a5a6df34cb8bc598dfa27f71213d822afb470aaf0018ee4", // Premium Ankr endpoint
  backupRpcUrls: [
    "https://bsc-dataseed.binance.org/",
    "https://bsc-dataseed1.binance.org/",
    "https://rpc.ankr.com/bsc"
  ], // Backup RPC endpoints
  blockExplorer: "https://bscscan.com",

  // WalletConnect
  walletConnectProjectId: "ec1a030594f38292648794d4587912f4", // <-- replace if needed

  // Helper functions
  isTestnet: function () {
    return this.chainId === 97
  },

  getExplorerUrl: function (txHash) {
    return `${this.blockExplorer}/tx/${txHash}`
  },

  getAddressUrl: function (address) {
    return `${this.blockExplorer}/address/${address}`
  },
}

// Export individual values for convenience
export const { contractAddress, usdtAddress, chainId, chainName, rpcUrl, blockExplorer, walletConnectProjectId, defaultReferrer } =
  config

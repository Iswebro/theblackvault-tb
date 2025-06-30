// Network configuration
export const config = {
  // Contract settings
  contractAddress: process.env.REACT_APP_CONTRACT_ADDRESS || "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  usdtAddress: process.env.REACT_APP_USDT_ADDRESS || "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd", // BSC Testnet USDT

  // Network settings
  chainId: Number.parseInt(process.env.REACT_APP_CHAIN_ID || "97"),
  chainName: process.env.REACT_APP_CHAIN_NAME || "BSC Testnet",
  rpcUrl: process.env.REACT_APP_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545",
  blockExplorer: process.env.REACT_APP_BLOCK_EXPLORER || "https://testnet.bscscan.com",

  // WalletConnect
  walletConnectProjectId: process.env.REACT_APP_WALLETCONNECT_PROJECT_ID || "ec1a030594f38292648794d4587912f4",

  // Helper functions
  isTestnet: function () {
    return this.chainId === 97
  },

  getExplorerUrl: function (txHash: string) {
    return `${this.blockExplorer}/tx/${txHash}`
  },

  getAddressUrl: function (address: string) {
    return `${this.blockExplorer}/address/${address}`
  },
}

// Export individual values for convenience
export const { contractAddress, usdtAddress, chainId, chainName, rpcUrl, blockExplorer, walletConnectProjectId } =
  config

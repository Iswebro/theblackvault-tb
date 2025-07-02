// Network configuration
export const config = {
  // Contract settings for BSC Testnet
  contractAddress: process.env.REACT_APP_CONTRACT_ADDRESS!,
  usdtAddress: process.env.REACT_APP_USDT_ADDRESS!,

  // Network settings for BSC Testnet
  chainId: Number.parseInt(process.env.REACT_APP_CHAIN_ID!),
  chainName: process.env.REACT_APP_CHAIN_NAME!,
  rpcUrl: process.env.REACT_APP_RPC_URL!,
  blockExplorer: process.env.REACT_APP_BLOCK_EXPLORER!,

  // WalletConnect
  walletConnectProjectId: process.env.REACT_APP_WALLETCONNECT_PROJECT_ID!,

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

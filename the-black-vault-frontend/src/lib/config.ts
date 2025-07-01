// Configuration for the Black Vault application
export const config = {
  // Contract addresses
  CONTRACT_ADDRESS: process.env.REACT_APP_CONTRACT_ADDRESS || "0x08b7fCcb9c92cB3C6A3279Bc377F461fD6fD97A1",
  USDT_ADDRESS: process.env.REACT_APP_USDT_ADDRESS || "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",

  // Network configuration
  CHAIN_ID: Number.parseInt(process.env.REACT_APP_CHAIN_ID || "97"),
  CHAIN_NAME: process.env.REACT_APP_CHAIN_NAME || "BSC Testnet",
  RPC_URL: process.env.REACT_APP_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545",
  BLOCK_EXPLORER: process.env.REACT_APP_BLOCK_EXPLORER || "https://testnet.bscscan.com",

  // Network details for wallet
  NETWORK_CONFIG: {
    chainId: "0x61", // 97 in hex for BSC Testnet
    chainName: "BSC Testnet",
    nativeCurrency: {
      name: "BNB",
      symbol: "BNB",
      decimals: 18,
    },
    rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545"],
    blockExplorerUrls: ["https://testnet.bscscan.com/"],
  },
}

require("@nomicfoundation/hardhat-toolbox")
require("dotenv").config()

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.28", // Use the exact compiler version shown in BSCScan's debug log
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          // Add this to specify the EVM version for compilation
          // 'paris' (Shanghai) is often used for BSC deployments
          // You might also try 'london' if 'paris' doesn't work,
          // or check the BSCScan documentation for their default EVM version.
          evmVersion: "paris",
        },
      },
      // You can keep 0.8.20 as a fallback if needed, but primary focus on 0.8.28
      { version: "0.8.20", settings: { optimizer: { enabled: true, runs: 200 } } },
    ],
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 20_000_000_000, // 20 gwei
    },
    bscMainnet: {
      url: process.env.BSC_MAINNET_RPC_URL || "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 5_000_000_000, // 5 gwei
    },
  },
  etherscan: {
    apiKey: {
      bscTestnet: process.env.BSCSCAN_API_KEY || "8XJ1R73Q3XSDTEYXDNM7PD4931CZRDM5JC",
      bsc: process.env.BSCSCAN_API_KEY || "8XJ1R73Q3XSDTEYXDNM7PD4931CZRDM5JC",
    },
  },
}

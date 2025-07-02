require("dotenv").config();
const { AbiCoder } = require("ethers");

async function main() {
  const args = [
    25,
    86400,
    250000000,
    50000000,
    "0x55d398326f99059fF775485246999027B3197955", // Mainnet USDT
    "0x5048cF3Cb7c28A691BC22Ea8de36E0f1e52Ca4a9", // Fee wallet
  ];

  const abiCoder = new AbiCoder();
  const encoded = abiCoder.encode(
    ["uint256", "uint256", "uint256", "uint256", "address", "address"],
    args
  );

  console.log("ABI-encoded constructor arguments:");
  console.log(encoded);
}

main();

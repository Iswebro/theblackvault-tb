import { ethers } from "ethers";
import BlackVaultABI from "./BlackVaultABI.json";

const CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // Replace with your deployed address

export const getContract = (providerOrSigner) => {
  return new ethers.Contract(CONTRACT_ADDRESS, BlackVaultABI.abi, providerOrSigner);
};

export const deposit = async (signer, amountInEth) => {
  const contract = getContract(signer);
  const tx = await contract.deposit({ value: ethers.utils.parseEther(amountInEth) });
  await tx.wait();
  return tx;
};

export const withdraw = async (signer) => {
  const contract = getContract(signer);
  const tx = await contract.withdraw();
  await tx.wait();
  return tx;
};

export const getUserInfo = async (provider, address) => {
  const contract = getContract(provider);
  const depositData = await contract.vault(address);
  const totalWithdrawn = await contract.totalWithdrawn(address);
  return {
    amount: ethers.utils.formatEther(depositData.amount),
    rewards: ethers.utils.formatEther(depositData.rewards),
    lastCycle: depositData.lastCycle.toString(),
    withdrawn: ethers.utils.formatEther(totalWithdrawn),
  };
};

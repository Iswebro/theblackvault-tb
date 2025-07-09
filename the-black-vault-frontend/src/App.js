"use client"

import { useState, useEffect } from "react"
import { ethers, Contract } from "ethers"
import BlackVaultAbi from "./BlackVault.json"
import ERC20Abi from "./ERC20.json"
import { formatEther } from "ethers/lib/utils"
import { ToastContainer, toast } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import "./App.css"

const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS
const USDT_ADDRESS = process.env.REACT_APP_USDT_ADDRESS

function App() {
  const [account, setAccount] = useState("")
  const [signer, setSigner] = useState(null)
  const [contract, setContract] = useState(null)
  const [usdtContract, setUsdtContract] = useState(null)
  const [balance, setBalance] = useState("0.0")
  const [rewards, setRewards] = useState("0.0")
  const [referralRewards, setReferralRewards] = useState("0.0")
  const [referralCount, setReferralCount] = useState("0")
  const [minDeposit, setMinDeposit] = useState("0.0")
  const [usdtAllowance, setUsdtAllowance] = useState("0.0")
  const [vaultActiveAmount, setVaultActiveAmount] = useState("0.0")
  const [dailyRate, setDailyRate] = useState("0")
  const [timeUntilNextCycle, setTimeUntilNextCycle] = useState(0)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [depositAmount, setDepositAmount] = useState("")
  const [referralAddress, setReferralAddress] = useState("")
  const [referralBonusesRemaining, setReferralBonusesRemaining] = useState("0")

  const addToast = (message, type) => {
    toast(message, {
      type: type,
      position: toast.POSITION.TOP_RIGHT,
    })
  }

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" })
        const provider = new ethers.providers.Web3Provider(window.ethereum)
        const signer = provider.getSigner()

        setAccount(accounts[0])
        setSigner(signer)
        addToast("Wallet connected!", "success")
      } catch (error) {
        console.error("Error connecting to wallet:", error)
        addToast("Failed to connect wallet.", "error")
      }
    } else {
      addToast("Please install MetaMask!", "error")
    }
  }

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", async () => {
        await connectWallet()
      })
    }
  }, [])

  useEffect(() => {
    if (signer) {
      initializeContracts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signer])

  useEffect(() => {
    let intervalId

    if (timeUntilNextCycle > 0) {
      intervalId = setInterval(() => {
        setTimeUntilNextCycle((prevTime) => prevTime - 1)
      }, 1000)
    }

    return () => clearInterval(intervalId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUntilNextCycle])

  const initializeContracts = async () => {
    try {
      const blackVaultContract = new Contract(CONTRACT_ADDRESS, BlackVaultAbi, signer)
      setContract(blackVaultContract)

      const usdtTokenContract = new Contract(USDT_ADDRESS, ERC20Abi, signer)
      setUsdtContract(usdtTokenContract)

      addToast("Contracts initialized!", "success")
      loadContractData(blackVaultContract, usdtTokenContract)
      loadTransactionHistory(blackVaultContract)
    } catch (error) {
      console.error("Error initializing contracts:", error)
      addToast("Failed to initialize contracts.", "error")
    }
  }

  const loadContractData = async (blackVaultContract, usdtTokenContract) => {
    setLoading(true)
    try {
      const [
        userVault,
        userReferralData,
        minDepositValue,
        usdtAllowanceValue,
        contractStats,
        dailyRateValue,
        timeUntilNextCycleValue,
        referralBonusInfo,
      ] = await Promise.all([
        blackVaultContract.getUserVault(account),
        blackVaultContract.getUserReferralData(account),
        blackVaultContract.MIN_DEPOSIT(),
        usdtTokenContract.allowance(account, CONTRACT_ADDRESS),
        blackVaultContract.getContractStats(),
        blackVaultContract.DAILY_RATE(),
        blackVaultContract.getTimeUntilNextCycle(),
        blackVaultContract.getReferralBonusInfo(referralAddress, account),
      ])

      setBalance(formatEther(userVault.totalDeposited))
      setRewards(formatEther(userVault.pendingRewards))
      setReferralRewards(formatEther(userReferralData.availableRewards))
      setReferralCount(userReferralData.referredCount.toString())
      setMinDeposit(formatEther(minDepositValue))
      setUsdtAllowance(formatEther(usdtAllowanceValue))
      setVaultActiveAmount(formatEther(userVault.activeAmount))
      setDailyRate(dailyRateValue.toString())
      setTimeUntilNextCycle(timeUntilNextCycleValue.toNumber())
      setReferralBonusesRemaining(referralBonusInfo.bonusesRemaining.toString())

      addToast("Contract data loaded!", "success")
    } catch (error) {
      console.error("Error loading contract data:", error)
      addToast("Failed to load contract data.", "error")
    } finally {
      setLoading(false)
    }
  }

  const loadTransactionHistory = async (blackVaultContract) => {
    try {
      const filterDeposited = blackVaultContract.filters.Deposited(account, null, null, null)
      const filterRewardsWithdrawn = blackVaultContract.filters.RewardsWithdrawn(account, null, null)
      const filterReferralRewardsWithdrawn = blackVaultContract.filters.ReferralRewardsWithdrawn(account, null)

      const [depositedEvents, rewardsWithdrawnEvents, referralRewardsWithdrawnEvents] = await Promise.all([
        blackVaultContract.queryFilter(filterDeposited),
        blackVaultContract.queryFilter(filterRewardsWithdrawn),
        blackVaultContract.queryFilter(filterReferralRewardsWithdrawn),
      ])

      const formattedHistory = [
        ...depositedEvents.map((event) => ({
          type: "Deposit",
          amount: formatEther(event.args.amount),
          timestamp: new Date(event.block.timestamp * 1000).toLocaleString(),
          txHash: event.transactionHash,
        })),
        ...rewardsWithdrawnEvents.map((event) => ({
          type: "Rewards Withdrawal",
          amount: formatEther(event.args.amount),
          timestamp: new Date(event.block.timestamp * 1000).toLocaleString(),
          txHash: event.transactionHash,
        })),
        ...referralRewardsWithdrawnEvents.map((event) => ({
          type: "Referral Rewards Withdrawal",
          amount: formatEther(event.args.amount),
          timestamp: new Date(event.block.timestamp * 1000).toLocaleString(),
          txHash: event.transactionHash,
        })),
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

      setHistory(formattedHistory)
      addToast("Transaction history loaded!", "success")
    } catch (error) {
      console.error("Error loading transaction history:", error)
      addToast("Failed to load transaction history.", "error")
    }
  }

  const disconnect = () => {
    setAccount("")
    setSigner(null)
    setContract(null)
    setUsdtContract(null)
    setBalance("0.0")
    setRewards("0.0")
    setReferralRewards("0.0")
    setReferralCount("0")
    setMinDeposit("0.0")
    setUsdtAllowance("0.0")
    setVaultActiveAmount("0.0")
    setDailyRate("0")
    setTimeUntilNextCycle(0)
    setHistory([])
    setLoading(false)
    setDepositAmount("")
    setReferralAddress("")
    setReferralBonusesRemaining("0")
    addToast("Wallet disconnected!", "info")
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Black Vault</h1>
        <button className="connect-button" onClick={account ? disconnect : connectWallet}>
          {account ? "Disconnect Wallet" : "Connect Wallet"}
        </button>
        {account && <p>Account: {account}</p>}
      </header>
      <div className="App-body">
        {loading && <div className="loader">Loading...</div>}

        {account ? (
          <>
            <div className="balances">
              <div className="balance-item">
                <h2>Vault Balance</h2>
                <p>{balance} USDT</p>
              </div>
              <div className="balance-item">
                <h2>Active Amount</h2>
                <p>{vaultActiveAmount} USDT</p>
              </div>
              <div className="balance-item">
                <h2>Rewards</h2>
                <p>{rewards} USDT</p>
              </div>
              <div className="balance-item">
                <h2>Referral Rewards</h2>
                <p>{referralRewards} USDT</p>
              </div>
            </div>

            <div className="stats">
              <div className="stat-item">
                <p>Minimum Deposit: {minDeposit} USDT</p>
              </div>
              <div className="stat-item">
                <p>USDT Allowance: {usdtAllowance} USDT</p>
              </div>
              <div className="stat-item">
                <p>Daily Rate: {dailyRate}%</p>
              </div>
              <div className="stat-item">
                <p>Time Until Next Cycle: {timeUntilNextCycle} seconds</p>
              </div>
              <div className="stat-item">
                <p>Referral Count: {referralCount}</p>
              </div>
              <div className="stat-item">
                <p>Referral Bonuses Remaining: {referralBonusesRemaining}</p>
              </div>
            </div>

            <div className="deposit-section">
              <h2>Deposit USDT</h2>
              <input
                type="number"
                placeholder="Enter deposit amount"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
              <input
                type="text"
                placeholder="Enter referral address (optional)"
                value={referralAddress}
                onChange={(e) => setReferralAddress(e.target.value)}
              />
              <button>Deposit</button>
            </div>

            <div className="history-section">
              <h2>Transaction History</h2>
              {history.length > 0 ? (
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Timestamp</th>
                      <th>Transaction Hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item, index) => (
                      <tr key={index}>
                        <td>{item.type}</td>
                        <td>{item.amount}</td>
                        <td>{item.timestamp}</td>
                        <td>
                          <a href={`https://etherscan.io/tx/${item.txHash}`} target="_blank" rel="noopener noreferrer">
                            View on Etherscan
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No transaction history available.</p>
              )}
            </div>
          </>
        ) : (
          <p>Please connect your wallet to view your vault.</p>
        )}
      </div>
      <ToastContainer />
    </div>
  )
}

export default App

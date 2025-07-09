"use client"

import { useEffect, useState, useRef } from "react"
import { Contract, formatEther, parseEther } from "ethers"
import { connectInjected, getReferralFromURL } from "./connectWallet"
import { useToast, ToastContainer } from "./components/Toast"
import BlackVaultAbi from "./contract/BlackVaultABI.json"
import ERC20Abi from "./contract/ERC20Abi.json"
import "./App.css"
import { config } from "./lib/config.ts"
import HowItWorks from "./components/HowItWorks"
import Leaderboard from "./components/Leaderboard"
import ReferralsModal from "./components/ReferralsModal"
import TroubleshootingModal from "./components/TroubleshootingModal" // New import

const CONTRACT_ADDRESS = config.contractAddress
const USDT_ADDRESS = config.usdtAddress

export default function App() {
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [account, setAccount] = useState("")
  const [contract, setContract] = useState(null)
  const [usdtContract, setUsdtContract] = useState(null)

  const [balance, setBalance] = useState("0") // BNB balance
  const [usdtBalance, setUsdtBalance] = useState("0") // USDT balance
  const [depositAmount, setDepositAmount] = useState("")
  const [rewards, setRewards] = useState("0")
  const [referralRewards, setReferralRewards] = useState("0")
  // ← Added this missing piece of state:
  const [referralAddress, setReferralAddress] = useState("")

  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [txLoading, setTxLoading] = useState(false)
  const [referralCount, setReferralCount] = useState(0)
  const [minDeposit, setMinDeposit] = useState("0")
  const [usdtAllowance, setUsdtAllowance] = useState("0")
  const [vaultActiveAmount, setVaultActiveAmount] = useState("0")
  const [referralBonusesRemaining, setReferralBonusesRemaining] = useState(3)
  const [showReferralsModal, setShowReferralsModal] = useState(false)
  const [showTroubleshootingModal, setShowTroubleshootingModal] = useState(false) // New state for troubleshooting modal
  const [dailyRate, setDailyRate] = useState("0")
  const [timeUntilNextCycle, setTimeUntilNextCycle] = useState(0) // New state for countdown

  const { toasts, addToast, removeToast } = useToast()

  const isManuallyDisconnected = useRef(false)
  const [showDisclaimer, setShowDisclaimer] = useState(true)

  // Get referral from URL on component mount
  useEffect(() => {
    const refFromURL = getReferralFromURL()
    setReferralAddress(refFromURL)
  }, [])

  // Initialize contracts when wallet connects
  useEffect(() => {
    if (signer && account && provider) {
      console.log("Initializing contracts for account:", account)
      initializeContracts()
    }
  }, [signer, account, provider])

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = async (accounts) => {
        console.log("Accounts changed event received:", accounts)
        if (accounts.length === 0) {
          console.log("No accounts found, disconnecting.")
          if (!isManuallyDisconnected.current) {
            disconnect()
          }
        } else if (account && accounts[0].toLowerCase() !== account.toLowerCase()) {
          if (!isManuallyDisconnected.current) {
            console.log("Account switched from", account, "to", accounts[0])
            setAccount(accounts[0])
            addToast("Account switched", "info")
          }
        } else if (!account && accounts.length > 0 && !isManuallyDisconnected.current) {
          console.log("Initial account detected:", accounts[0])
          setAccount(accounts[0])
          addToast("Wallet connected successfully!", "success")
        }
      }

      const handleChainChanged = () => {
        console.log("Chain changed, reloading page.")
        window.location.reload()
      }

      window.ethereum.on("accountsChanged", handleAccountsChanged)
      window.ethereum.on("chainChanged", handleChainChanged)

      window.ethereum
        .request({ method: "eth_accounts" })
        .then(handleAccountsChanged)
        .catch((err) => console.error("Error getting initial accounts:", err))

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
          window.ethereum.removeListener("chainChanged", handleChainChanged)
        }
      }
    }
  }, [account, addToast])

  const initializeContracts = async () => {
    if (!signer) return
    try {
      const vault = new Contract(CONTRACT_ADDRESS, BlackVaultAbi, signer)
      setContract(vault)
      console.log("BlackVault Contract initialized.")

      const usdt = new Contract(USDT_ADDRESS, ERC20Abi, signer)
      setUsdtContract(usdt)
      console.log("USDT Contract initialized.")

      // Pass the newly created contracts directly to load data
      await loadContractData(vault, usdt)
    } catch (error) {
      console.error("Error initializing contracts:", error)
      addToast("Error connecting to contracts", "error")
    }
  }

  const loadTransactionHistory = async (vault, usdt) => {
    if (!vault || !provider || !account) {
      console.log("Skipping loadTransactionHistory: missing vault, provider, or account")
      return
    }

    try {
      const depositEvents = await vault.queryFilter(vault.filters.Deposited(account), -10000)
      const rewardsWithdrawEvents = await vault.queryFilter(vault.filters.RewardsWithdrawn(account), -10000)
      const referralWithdrawEvents = await vault.queryFilter(vault.filters.ReferralRewardsWithdrawn(account), -10000)

      const processEvent = async (event, type) => {
        const block = await provider.getBlock(event.blockNumber)
        return {
          type,
          amount: formatEther(event.args.amount),
          time: new Date(block.timestamp * 1000),
          txHash: event.transactionHash,
        }
      }

      const allEvents = await Promise.all([
        ...depositEvents.map((e) => processEvent(e, "Deposit")),
        ...rewardsWithdrawEvents.map((e) => processEvent(e, "Rewards Withdrawn")),
        ...referralWithdrawEvents.map((e) => processEvent(e, "Referral Withdrawal")),
      ])

      allEvents.sort((a, b) => b.time - a.time)
      setHistory(allEvents)
    } catch (error) {
      console.error("Error loading transaction history:", error)
      setHistory([])
    }
  }

  const loadContractData = async (vault = contract, usdt = usdtContract) => {
    if (!vault || !provider || !account || !usdt) {
      console.log("Skipping loadContractData: missing dependencies", { vault, provider, account, usdt })
      return
    }

    console.log("Loading contract data for account:", account)
    try {
      const userBnbBalance = await provider.getBalance(account)
      setBalance(formatEther(userBnbBalance))

      const userUsdtBalance = await usdt.balanceOf(account)
      setUsdtBalance(formatEther(userUsdtBalance))

      const allowance = await usdt.allowance(account, CONTRACT_ADDRESS)
      setUsdtAllowance(formatEther(allowance))

      try {
        const vaultData = await vault.getUserVault(account)
        setRewards(formatEther(vaultData.pendingRewards))
        setVaultActiveAmount(formatEther(vaultData.activeAmount))
      } catch {
        setRewards("0")
        setVaultActiveAmount("0")
      }

      try {
        const refData = await vault.getUserReferralData(account)
        setReferralRewards(formatEther(refData.availableRewards))
        setReferralCount(refData.referredCount.toString())
      } catch {
        setReferralRewards("0")
        setReferralCount("0")
      }

      if (referralAddress && referralAddress !== ethers.ZeroAddress) {
        try {
          const bonusInfo = await vault.getReferralBonusInfo(referralAddress, account)
          setReferralBonusesRemaining(bonusInfo.bonusesRemaining.toNumber())
        } catch {
          setReferralBonusesRemaining(3)
        }
      }

      try {
        const minDepositValue = await vault.MIN_DEPOSIT()
        setMinDeposit(formatEther(minDepositValue))
      } catch {
        setMinDeposit("0")
      }

      try {
        const dailyRateValue = await vault.DAILY_RATE()
        setDailyRate(dailyRateValue.toString())
      } catch {
        setDailyRate("0")
      }

      try {
        const timeRemaining = await vault.getTimeUntilNextCycle()
        setTimeUntilNextCycle(timeRemaining.toNumber())
      } catch {
        setTimeUntilNextCycle(0)
      }

      await loadTransactionHistory(vault, usdt)
    } catch (error) {
      console.error("Error loading contract data:", error)
      addToast("Error loading data from contract", "error")
    }
  }

  // ... the rest of your handlers, effects, JSX, etc. remain unchanged ...

  return (
    // ... your render logic ...
    <div>…</div>
  )
}

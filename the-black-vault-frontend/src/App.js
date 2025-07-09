"use client"

import { useEffect, useState, useRef } from "react"
import { ethers, Contract, formatEther, parseEther } from "ethers"
import { connectInjected, getReferralFromURL } from "./connectWallet"
import { useToast, ToastContainer } from "./components/Toast"
import BlackVaultAbi from "./contract/BlackVaultABI.json"
import ERC20Abi from "./contract/ERC20Abi.json"
import "./App.css"
import { config } from "./lib/config.ts"
import HowItWorks from "./components/HowItWorks"
import Leaderboard from "./components/Leaderboard"
import ReferralsModal from "./components/ReferralsModal"
import TroubleshootingModal from "./components/TroubleshootingModal"

const CONTRACT_ADDRESS = config.contractAddress
const USDT_ADDRESS = config.usdtAddress

export default function App() {
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [account, setAccount] = useState("")
  const [contract, setContract] = useState(null)
  const [usdtContract, setUsdtContract] = useState(null)

  const [balance, setBalance] = useState("0")
  const [usdtBalance, setUsdtBalance] = useState("0")
  const [depositAmount, setDepositAmount] = useState("")
  const [rewards, setRewards] = useState("0")
  const [referralRewards, setReferralRewards] = useState("0")
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
  const [showTroubleshootingModal, setShowTroubleshootingModal] = useState(false)
  const [dailyRate, setDailyRate] = useState("0")
  const [timeUntilNextCycle, setTimeUntilNextCycle] = useState(0)

  const { toasts, addToast, removeToast } = useToast()
  const isManuallyDisconnected = useRef(false)
  const [showDisclaimer, setShowDisclaimer] = useState(true)

  // --- MOVE disconnect ABOVE any useEffect that uses it ----
  const disconnect = () => {
    isManuallyDisconnected.current = true
    setProvider(null)
    setSigner(null)
    setAccount("")
    setContract(null)
    setUsdtContract(null)
    setBalance("0")
    setUsdtBalance("0")
    setUsdtAllowance("0")
    setRewards("0")
    setReferralRewards("0")
    setHistory([])
    setReferralCount("0")
    setMinDeposit("0")
    setVaultActiveAmount("0")
    setReferralBonusesRemaining("3")
    setShowReferralsModal(false)
    addToast("Wallet disconnected", "info")
  }

  // Listen for account & chain changes
  useEffect(() => {
    if (!window.ethereum) return
    const handleAccountsChanged = async (accounts) => {
      if (accounts.length === 0) {
        if (!isManuallyDisconnected.current) disconnect()
      } else if (account && accounts[0].toLowerCase() !== account.toLowerCase()) {
        if (!isManuallyDisconnected.current) {
          setAccount(accounts[0])
          addToast("Account switched", "info")
        }
      } else if (!account && accounts.length > 0 && !isManuallyDisconnected.current) {
        setAccount(accounts[0])
        addToast("Wallet connected successfully!", "success")
      }
    }
    const handleChainChanged = () => window.location.reload()

    window.ethereum.on("accountsChanged", handleAccountsChanged)
    window.ethereum.on("chainChanged", handleChainChanged)
    window.ethereum
      .request({ method: "eth_accounts" })
      .then(handleAccountsChanged)
      .catch(console.error)

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
      window.ethereum.removeListener("chainChanged", handleChainChanged)
    }
  }, [account, addToast])

  // Get referral from URL
  useEffect(() => {
    setReferralAddress(getReferralFromURL())
  }, [])

  // Initialize on connect
  useEffect(() => {
    if (signer && account && provider) initializeContracts()
  }, [signer, account, provider])

  // --- all your other functions (initializeContracts, loadContractData, loadTransactionHistory, connectWallet, approveUsdt, deposit, withdraw, withdrawReferral, etc.) remain unchanged ---

  // Example of including ethers usage, e.g. ZeroAddress if needed:
  // if (referrer === ethers.ZeroAddress) { ... }

  // Your JSX rendering here...
  // (unchanged from your existing return blocks)
}

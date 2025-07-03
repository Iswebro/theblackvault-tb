"use client"

import { useEffect, useState, useRef } from "react"
import { SpeedInsights } from "@vercel/speed-insights"
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
import TroubleshootingModal from "./components/TroubleshootingModal"

const CONTRACT_ADDRESS = config.contractAddress
const USDT_ADDRESS    = config.usdtAddress

export default function App() {
  const [provider, setProvider]             = useState(null)
  const [signer, setSigner]                 = useState(null)
  const [account, setAccount]               = useState("")
  const [contract, setContract]             = useState(null)
  const [usdtContract, setUsdtContract]     = useState(null)
  const [balance, setBalance]               = useState("0")
  const [usdtBalance, setUsdtBalance]       = useState("0")
  const [depositAmount, setDepositAmount]   = useState("")
  const [rewards, setRewards]               = useState("0")
  const [referralRewards, setReferralRewards] = useState("0")
  const [referralAddress, setReferralAddress] = useState("")
  const [history, setHistory]               = useState([])
  const [loading, setLoading]               = useState(false)
  const [txLoading, setTxLoading]           = useState(false)
  const [referralCount, setReferralCount]   = useState(0)
  const [minDeposit, setMinDeposit]         = useState("0")
  const [usdtAllowance, setUsdtAllowance]   = useState("0")
  const [vaultActiveAmount, setVaultActiveAmount] = useState("0")
  const [referralBonusesRemaining, setReferralBonusesRemaining] = useState(3)
  const [showReferralsModal, setShowReferralsModal] = useState(false)
  const [showTroubleshootingModal, setShowTroubleshootingModal] = useState(false)
  const [dailyRate, setDailyRate]           = useState("0")
  const [timeUntilNextCycle, setTimeUntilNextCycle] = useState(0)

  const { toasts, addToast, removeToast }  = useToast()
  const isManuallyDisconnected             = useRef(false)
  const [showDisclaimer, setShowDisclaimer] = useState(true)

  useEffect(() => {
    const refFromURL = getReferralFromURL()
    setReferralAddress(refFromURL)
  }, [])

  useEffect(() => {
    if (signer && account && provider) {
      initializeContracts()
    }
  }, [signer, account, provider])

  useEffect(() => {
    if (window.ethereum) {
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
          addToast("Wallet connected successfully", "success")
        }
      }

      const handleChainChanged = () => {
        window.location.reload()
      }

      window.ethereum.on("accountsChanged", handleAccountsChanged)
      window.ethereum.on("chainChanged", handleChainChanged)
      window.ethereum.request({ method: "eth_accounts" }).then(handleAccountsChanged)

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
        window.ethereum.removeListener("chainChanged", handleChainChanged)
      }
    }
  }, [account, addToast])

  const initializeContracts = async () => {
    if (!signer) return
    try {
      const vault = new Contract(CONTRACT_ADDRESS, BlackVaultAbi, signer)
      setContract(vault)
      const usdt = new Contract(USDT_ADDRESS, ERC20Abi, signer)
      setUsdtContract(usdt)
      await loadContractData(vault, usdt)
    } catch (error) {
      addToast("Error connecting to contracts", "error")
    }
  }

  // ... your loadTransactionHistory and loadContractData functions remain unchanged ...

  const connectWallet = async () => {
    if (loading) return
    setLoading(true)
    try {
      isManuallyDisconnected.current = false
      await new Promise((r) => setTimeout(r, 100))
      const conn = await connectInjected()
      setProvider(conn.provider)
      setSigner(conn.signer)
      setAccount(conn.account)
      addToast("Wallet connected successfully", "success")
    } catch (error) {
      let msg = "Failed to connect wallet"
      if (error.code === 4001) msg = "Connection cancelled"
      addToast(msg, "error")
    } finally {
      setLoading(false)
    }
  }

  // ... your approveUsdt, deposit, withdraw, withdrawReferral, disconnect, helpers ...

  if (!account) {
    return (
      <>
        <SpeedInsights />
        <div className="app-container">
          <ToastContainer toasts={toasts} removeToast={removeToast} />

          <div className="connect-screen">
            <div className="connect-content">
              {/* logo, title, subtitle */}
              <button onClick={connectWallet} disabled={loading} className="connect-button premium-button">
                {loading ? "Connecting..." : "Connect Wallet"}
              </button>
              <button className="discreet-button" onClick={() => setShowTroubleshootingModal(true)}>
                Troubleshooting & Network Info
              </button>
            </div>
          </div>

          <TroubleshootingModal
            isOpen={showTroubleshootingModal}
            onClose={() => setShowTroubleshootingModal(false)}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <SpeedInsights />
      <div className="app-container">
        <ToastContainer toasts={toasts} removeToast={removeToast} />

        {/* your main interface JSX: header, vault cards, leaderboard, etc */}

      </div>
    </>
  )
}

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
import TroubleshootingModal from "./components/TroubleshootingModal"

const V2_ADDRESS = config.contractAddress
const V1_ADDRESS = "0x08b7fCcb9c92cB3C6A3279Bc377F461fD6fD97A1"
const USDT_ADDRESS = config.usdtAddress

export default function App() {
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [account, setAccount] = useState("")
  const [v2Contract, setV2Contract] = useState(null)
  const [v1Contract, setV1Contract] = useState(null)
  const [usdtContract, setUsdtContract] = useState(null)

  const [vaultActiveAmount, setVaultActiveAmount] = useState("0")
  const [rewards, setRewards] = useState("0")
  const [referralRewards, setReferralRewards] = useState("0")

  const [txLoading, setTxLoading] = useState(false)
  const [showReferralsModal, setShowReferralsModal] = useState(false)
  const [showTroubleshootingModal, setShowTroubleshootingModal] = useState(false)

  const { toasts, addToast, removeToast } = useToast()
  const isManuallyDisconnected = useRef(false)

  // On mount, grab referral from URL
  useEffect(() => {
    const ref = getReferralFromURL()
    setReferralAddress(ref)
  }, [])

  // When signer/account/provider ready, init both V2 & V1 contracts
  useEffect(() => {
    if (signer && account && provider) {
      const init = async () => {
        const v2 = new Contract(V2_ADDRESS, BlackVaultAbi, signer)
        setV2Contract(v2)
        const v1 = new Contract(V1_ADDRESS, BlackVaultAbi, signer)
        setV1Contract(v1)
        const usdt = new Contract(USDT_ADDRESS, ERC20Abi, signer)
        setUsdtContract(usdt)
        await loadV2Data(v2)
      }
      init().catch(console.error)
    }
  }, [signer, account, provider])

  // Load V2 vault & referral data
  const loadV2Data = async (vault) => {
    try {
      const vaultData = await vault.getUserVault(account)
      setRewards(formatEther(vaultData.pendingRewards))
      setVaultActiveAmount(formatEther(vaultData.activeAmount))

      const refData = await vault.getUserReferralData(account)
      setReferralRewards(formatEther(refData.availableRewards))
    } catch (e) {
      console.error("loadV2Data:", e)
    }
  }

  // Withdraw from V2
  const withdrawV2Rewards = async () => {
    if (!v2Contract) return
    setTxLoading(true)
    try {
      const tx = await v2Contract.withdrawRewards()
      addToast("V2: Withdrawing vault rewards...", "info")
      await tx.wait()
      addToast("V2 rewards withdrawn!", "success")
      await loadV2Data(v2Contract)
    } catch (e) {
      console.error(e)
      addToast("V2 withdrawal failed", "error")
    } finally {
      setTxLoading(false)
    }
  }

  // Withdraw referral from V2
  const withdrawV2Referral = async () => {
    if (!v2Contract) return
    setTxLoading(true)
    try {
      const tx = await v2Contract.withdrawReferralRewards()
      addToast("V2: Withdrawing referral rewards...", "info")
      await tx.wait()
      addToast("V2 referral withdrawn!", "success")
      await loadV2Data(v2Contract)
    } catch (e) {
      console.error(e)
      addToast("V2 referral withdrawal failed", "error")
    } finally {
      setTxLoading(false)
    }
  }

  // Withdraw from V1 vault
  const withdrawV1Rewards = async () => {
    if (!v1Contract) return
    setTxLoading(true)
    try {
      const tx = await v1Contract.withdrawRewards()
      addToast("V1: Withdrawing old vault rewards...", "info")
      await tx.wait()
      addToast("V1 rewards withdrawn!", "success")
    } catch (e) {
      console.error(e)
      addToast("V1 withdrawal failed", "error")
    } finally {
      setTxLoading(false)
    }
  }

  // Withdraw referral from V1
  const withdrawV1Referral = async () => {
    if (!v1Contract) return
    setTxLoading(true)
    try {
      const tx = await v1Contract.withdrawReferralRewards()
      addToast("V1: Withdrawing old referral rewards...", "info")
      await tx.wait()
      addToast("V1 referral withdrawn!", "success")
    } catch (e) {
      console.error(e)
      addToast("V1 referral withdrawal failed", "error")
    } finally {
      setTxLoading(false)
    }
  }

  // ... connectWallet, disconnect, formatAddress, etc. remain unchanged ...

  if (!account) {
    return (
      <div className="app-container">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        {/* ... connect screen ... */}
      </div>
    )
  }

  return (
    <div className="app-container">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Vault Rewards */}
      <div className="vault-card premium-card">
        <h3 className="card-title">Vault Rewards (V2)</h3>
        <p className="reward-amount">{rewards} USDT</p>
        <button
          className="vault-button premium-button success"
          onClick={withdrawV2Rewards}
          disabled={txLoading || parseFloat(rewards) === 0}
        >
          {txLoading ? "Processing..." : "Withdraw V2 Rewards"}
        </button>
        <button
          className="vault-button premium-button outline"
          onClick={withdrawV1Rewards}
          disabled={txLoading}
        >
          {txLoading ? "Processing..." : "Withdraw V1 Rewards"}
        </button>
      </div>

      {/* Referral Rewards */}
      <div className="vault-card premium-card">
        <h3 className="card-title">Referral Rewards (V2)</h3>
        <p className="reward-amount purple">{referralRewards} USDT</p>
        <button
          className="vault-button premium-button success"
          onClick={withdrawV2Referral}
          disabled={txLoading || parseFloat(referralRewards) === 0}
        >
          {txLoading ? "Processing..." : "Withdraw V2 Referral"}
        </button>
        <button
          className="vault-button premium-button outline"
          onClick={withdrawV1Referral}
          disabled={txLoading}
        >
          {txLoading ? "Processing..." : "Withdraw V1 Referral"}
        </button>
      </div>

      {/* ... rest of your UI (history, leaderboard, etc.) ... */}

    </div>
  )
}

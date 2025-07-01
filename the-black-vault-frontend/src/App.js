"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Contract, formatEther, parseEther } from "ethers"
import { connectInjected, getReferralFromURL } from "./connectWallet"
import { useToast, ToastContainer } from "./components/Toast"
import BlackVaultAbi from "./contract/BlackVaultABI.json"
import ERC20Abi from "./contract/ERC20Abi.json"
import "./App.css"
import HowItWorks from "./components/HowItWorks"
import Leaderboard from "./components/Leaderboard"
import ReferralsModal from "./components/ReferralsModal"

// Configuration is now read directly from environment variables here
const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS
const USDT_ADDRESS = process.env.REACT_APP_USDT_ADDRESS
const BLOCK_EXPLORER = process.env.REACT_APP_BLOCK_EXPLORER

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

  const { toasts, addToast, removeToast } = useToast()

  const isManuallyDisconnected = useRef(false)
  const [showDisclaimer, setShowDisclaimer] = useState(true)

  // Get referral from URL on component mount
  useEffect(() => {
    const refFromURL = getReferralFromURL()
    setReferralAddress(refFromURL)
  }, [])

  // More robust data loading logic
  const loadContractData = useCallback(async () => {
    if (!provider || !account || !contract || !usdtContract) {
      console.log("Aborting loadContractData: Dependencies not ready.", {
        provider: !!provider,
        account: !!account,
        contract: !!contract,
        usdtContract: !!usdtContract,
      })
      return
    }

    console.log("Starting to load all contract data for account:", account)
    try {
      const [userBnbBalance, userUsdtBalance, allowance, vaultData, refData, minDepositValue] = await Promise.all([
        provider.getBalance(account),
        usdtContract.balanceOf(account),
        usdtContract.allowance(account, CONTRACT_ADDRESS),
        contract
          .getUserVault(account)
          .catch(() => null), // Non-critical, can fail for new users
        contract
          .getUserReferralData(account)
          .catch(() => null), // Non-critical
        contract
          .MIN_DEPOSIT()
          .catch(() => parseEther("50")), // Fallback
      ])

      console.log("Fetched BNB Balance:", formatEther(userBnbBalance))
      setBalance(formatEther(userBnbBalance))

      console.log("Fetched USDT Balance:", formatEther(userUsdtBalance))
      setUsdtBalance(formatEther(userUsdtBalance))

      console.log("Fetched USDT Allowance:", formatEther(allowance))
      setUsdtAllowance(formatEther(allowance))

      if (vaultData) {
        console.log("Fetched Vault Data:", {
          rewards: formatEther(vaultData.pendingRewards),
          activeAmount: formatEther(vaultData.activeAmount),
        })
        setRewards(formatEther(vaultData.pendingRewards))
        setVaultActiveAmount(formatEther(vaultData.activeAmount))
      }

      if (refData) {
        console.log("Fetched Referral Data:", {
          rewards: formatEther(refData.availableRewards),
          count: refData.referredCount.toString(),
        })
        setReferralRewards(formatEther(refData.availableRewards))
        setReferralCount(refData.referredCount.toString())
      }

      console.log("Fetched Min Deposit:", formatEther(minDepositValue))
      setMinDeposit(formatEther(minDepositValue))

      // Load history separately as it's less critical
      loadTransactionHistory(contract, provider, account)
    } catch (error) {
      console.error("A critical error occurred while loading contract data:", error)
      addToast("Error loading data from contract", "error")
    }
  }, [provider, account, contract, usdtContract, addToast])

  // Initialize contracts and load data when signer is ready
  useEffect(() => {
    if (signer && account) {
      console.log("Signer and account are ready. Initializing contracts...")
      const vaultContract = new Contract(CONTRACT_ADDRESS, BlackVaultAbi, signer)
      const tokenContract = new Contract(USDT_ADDRESS, ERC20Abi, signer)
      setContract(vaultContract)
      setUsdtContract(tokenContract)
    }
  }, [signer, account])

  // This effect triggers the data load when contracts are set
  useEffect(() => {
    if (contract && usdtContract) {
      console.log("Contracts are initialized. Triggering data load.")
      loadContractData()
    }
  }, [contract, usdtContract, loadContractData])

  const loadTransactionHistory = async (vault, provider, userAccount) => {
    console.log("Loading transaction history...")
    try {
      const depositFilter = vault.filters.Deposited(userAccount)
      const rewardsWithdrawFilter = vault.filters.RewardsWithdrawn(userAccount)
      const referralWithdrawFilter = vault.filters.ReferralRewardsWithdrawn(userAccount)

      const [depositEvents, rewardsWithdrawEvents, referralWithdrawEvents] = await Promise.all([
        vault.queryFilter(depositFilter, -20000), // Look back further
        vault.queryFilter(rewardsWithdrawFilter, -20000),
        vault.queryFilter(referralWithdrawFilter, -20000),
      ])

      const processEvent = async (event, type) => {
        try {
          const block = await provider.getBlock(event.blockNumber)
          return {
            type: type,
            amount: formatEther(event.args.amount),
            time: new Date(block.timestamp * 1000),
            txHash: event.transactionHash,
          }
        } catch (e) {
          return null // Ignore events if block data fails
        }
      }

      const allEventsPromises = [
        ...depositEvents.map((event) => processEvent(event, "Deposit")),
        ...rewardsWithdrawEvents.map((event) => processEvent(event, "Rewards Withdrawn")),
        ...referralWithdrawEvents.map((event) => processEvent(event, "Referral Withdrawal")),
      ]

      const processedEvents = (await Promise.all(allEventsPromises)).filter(Boolean)

      processedEvents.sort((a, b) => b.time.getTime() - a.time.getTime())
      setHistory(processedEvents)
      console.log(`Loaded ${processedEvents.length} history items.`)
    } catch (error) {
      console.error("Error loading transaction history:", error)
      setHistory([])
    }
  }

  const connectWallet = async () => {
    if (loading) return
    setLoading(true)
    try {
      isManuallyDisconnected.current = false
      const conn = await connectInjected()
      setProvider(conn.provider)
      setSigner(conn.signer)
      setAccount(conn.account)
      addToast("Wallet connected successfully!", "success")
    } catch (error) {
      console.error("Connection failed in App.js:", error)
      addToast(error.message || "Failed to connect wallet", "error")
    } finally {
      setLoading(false)
    }
  }

  const approveUsdt = async () => {
    if (!usdtContract || txLoading || !depositAmount || Number.parseFloat(depositAmount) <= 0) return

    setTxLoading(true)
    try {
      addToast("Approving USDT...", "info")
      const amountToApprove = parseEther(depositAmount)

      const tx = await usdtContract.approve(CONTRACT_ADDRESS, amountToApprove)
      addToast("Approval transaction submitted. Waiting for confirmation...", "info")
      await tx.wait()
      addToast("USDT approved successfully!", "success")
      await loadContractData()
    } catch (error) {
      console.error("USDT approval failed:", error)
      addToast(error.code === 4001 ? "Transaction cancelled" : "USDT approval failed", "error")
    } finally {
      setTxLoading(false)
    }
  }

  const deposit = async () => {
    if (!contract || !depositAmount || txLoading || Number.parseFloat(depositAmount) <= 0) return

    if (Number.parseFloat(usdtAllowance) < Number.parseFloat(depositAmount)) {
      addToast("Please approve the required USDT amount first.", "warning")
      return
    }

    setTxLoading(true)
    try {
      addToast("Processing deposit...", "info")
      const value = parseEther(depositAmount)
      const tx =
        referralAddress && referralAddress !== "0x0000000000000000000000000000000000000000"
          ? await contract.depositWithReferrer(value, referralAddress)
          : await contract.deposit(value)

      addToast("Deposit transaction submitted. Waiting for confirmation...", "info")
      await tx.wait()
      addToast("Deposit successful!", "success")
      setDepositAmount("")
      await loadContractData()
    } catch (error) {
      console.error("Deposit failed:", error)
      addToast(error.code === 4001 ? "Transaction cancelled" : "Deposit failed", "error")
    } finally {
      setTxLoading(false)
    }
  }

  const withdraw = async () => {
    if (!contract || txLoading || Number.parseFloat(rewards) === 0) return

    setTxLoading(true)
    try {
      addToast("Withdrawing rewards...", "info")
      const tx = await contract.withdrawRewards()
      await tx.wait()
      addToast("Rewards withdrawn successfully!", "success")
      await loadContractData()
    } catch (error) {
      console.error("Withdraw failed:", error)
      addToast(error.code === 4001 ? "Transaction cancelled" : "Withdrawal failed", "error")
    } finally {
      setTxLoading(false)
    }
  }

  const withdrawReferral = async () => {
    if (!contract || txLoading || Number.parseFloat(referralRewards) === 0) return

    setTxLoading(true)
    try {
      addToast("Withdrawing referral rewards...", "info")
      const tx = await contract.withdrawReferralRewards()
      await tx.wait()
      addToast("Referral rewards withdrawn successfully!", "success")
      await loadContractData()
    } catch (error) {
      console.error("Referral withdraw failed:", error)
      addToast(error.code === 4001 ? "Transaction cancelled" : "Referral withdrawal failed", "error")
    } finally {
      setTxLoading(false)
    }
  }

  const disconnect = () => {
    isManuallyDisconnected.current = true
    setProvider(null)
    setSigner(null)
    setAccount("")
    setContract(null)
    setUsdtContract(null)
    // Reset all states
    setBalance("0")
    setUsdtBalance("0")
    setDepositAmount("")
    setRewards("0")
    setReferralRewards("0")
    setHistory([])
    setReferralCount(0)
    setMinDeposit("0")
    setUsdtAllowance("0")
    setVaultActiveAmount("0")
    addToast("Wallet disconnected", "info")
  }

  // Listen for account changes to auto-reconnect or disconnect
  useEffect(() => {
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        console.log("Wallet disconnected by user.")
        disconnect()
      } else if (account && accounts[0].toLowerCase() !== account.toLowerCase()) {
        console.log("Account switched to:", accounts[0])
        setAccount(accounts[0]) // This will trigger re-initialization
      }
    }
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged)
      return () => window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
    }
  }, [account])

  const formatAddress = (addr) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "")
  const formatAmount = (amount) => {
    const num = Number.parseFloat(amount)
    if (isNaN(num) || num === 0) return "0.00"
    return num.toFixed(4)
  }
  const handleMaxDeposit = () => setDepositAmount(usdtBalance)
  const getReferralLink = () => `${window.location.origin}${window.location.pathname}?ref=${account}`
  const copyReferralLink = () => {
    navigator.clipboard.writeText(getReferralLink())
    addToast("Referral link copied!", "success")
  }
  const needsApproval =
    Number.parseFloat(depositAmount) > 0 && Number.parseFloat(usdtAllowance) < Number.parseFloat(depositAmount)

  if (!account) {
    return (
      <div className="app-container">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <div className="connect-screen">
          <div className="connect-content">
            <div className="logo-container">
              <div className="premium-logo-wrapper">
                <img src="/logo2.svg" alt="Black Vault Logo" className="premium-logo-img" />
                <div className="logo-glow"></div>
              </div>
            </div>
            <h1 className="app-title">
              <span className="title-black">BLACK</span>
              <span className="title-vault">VAULT</span>
            </h1>
            <p className="app-subtitle">Premium USDT Staking Platform on Binance Smart Chain</p>
            <button className="connect-button premium-button" onClick={connectWallet} disabled={loading}>
              {loading ? (
                <>
                  <div className="loading-spinner"></div>Connecting...
                </>
              ) : (
                "Connect Wallet"
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="main-interface">
        <div className="header">
          <div className="header-logo">
            <img src="/logo2.svg" alt="Black Vault" className="mini-logo-img" />
            <span className="header-title">BLACK VAULT</span>
          </div>
          <div className="header-account">
            <span className="account-label">Connected</span>
            <span className="account-address">{formatAddress(account)}</span>
          </div>
        </div>

        <div className="vault-interface">
          <div className="vault-card premium-card">
            <h3 className="card-title">Vault Balance</h3>
            <div className="balance-grid">
              <div className="balance-item">
                <span className="balance-label">Active Deposit</span>
                <span className="balance-value">{formatAmount(vaultActiveAmount)} USDT</span>
              </div>
            </div>
          </div>

          <div className="vault-card premium-card">
            <h3 className="card-title">
              <span className="card-icon">💰</span>Make Deposit
            </h3>
            {referralAddress && referralAddress !== "0x0000000000000000000000000000000000000000" && (
              <div className="referral-info">
                <span className="referral-label">Referral:</span>
                <span className="referral-address">{formatAddress(referralAddress)}</span>
              </div>
            )}
            <div className="wallet-balance">
              <span className="balance-label">Wallet: {formatAmount(usdtBalance)} USDT</span>
              <button className="max-button" onClick={handleMaxDeposit}>
                Max
              </button>
            </div>
            <div className="input-group">
              <input
                type="number"
                className="vault-input premium-input"
                placeholder={`Min. ${formatAmount(minDeposit)} USDT`}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
              {needsApproval ? (
                <button className="vault-button premium-button primary" onClick={approveUsdt} disabled={txLoading}>
                  {txLoading ? (
                    <>
                      <div className="loading-spinner" />
                      Approving...
                    </>
                  ) : (
                    "Approve USDT"
                  )}
                </button>
              ) : (
                <button
                  className="vault-button premium-button primary"
                  onClick={deposit}
                  disabled={txLoading || !depositAmount || Number.parseFloat(depositAmount) <= 0}
                >
                  {txLoading ? (
                    <>
                      <div className="loading-spinner" />
                      Depositing...
                    </>
                  ) : (
                    "Deposit USDT"
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="vault-card premium-card">
            <h3 className="card-title">
              <span className="card-icon">🎁</span>Vault Rewards
            </h3>
            <div className="reward-display">
              <span className="reward-amount">{formatAmount(rewards)} USDT</span>
              <span className="reward-label">Available to withdraw</span>
            </div>
            <button
              className="vault-button premium-button success"
              onClick={withdraw}
              disabled={txLoading || Number.parseFloat(rewards) === 0}
            >
              {txLoading ? "Processing..." : "Withdraw Rewards"}
            </button>
          </div>

          <div className="vault-card premium-card">
            <h3 className="card-title">
              <span className="card-icon">👥</span>Referral Rewards
            </h3>
            <div className="reward-display">
              <span className="reward-amount purple">{formatAmount(referralRewards)} USDT</span>
              <span className="reward-label">From referrals</span>
            </div>
            <div className="referral-stats">
              <span className="referral-label">Total Referrals:</span>
              <span className="referral-value">{referralCount}</span>
            </div>
            <div className="referral-actions">
              <button className="copy-link-button" onClick={copyReferralLink}>
                Copy Link
              </button>
              <button className="see-referrals-button" onClick={() => setShowReferralsModal(true)}>
                See Referrals
              </button>
            </div>
            <button
              className="vault-button premium-button purple"
              onClick={withdrawReferral}
              disabled={txLoading || Number.parseFloat(referralRewards) === 0}
            >
              {txLoading ? "Processing..." : "Withdraw Referral Rewards"}
            </button>
          </div>

          <div className="vault-card premium-card">
            <h3 className="card-title">
              <span className="card-icon">📊</span>Transaction History
            </h3>
            {history.length === 0 ? (
              <div className="empty-state">
                <p className="empty-message">No transactions yet</p>
              </div>
            ) : (
              <div className="history-list">
                {history.map((item, index) => (
                  <div key={index} className="history-item">
                    <div className="history-info">
                      <div className={`history-dot ${item.type.toLowerCase().replace(/\s+/g, "-")}`}></div>
                      <div className="history-details">
                        <span className="history-type">{item.type}</span>
                        <span className="history-time">{item.time.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="history-amount">
                      <span className="amount-value">{formatAmount(item.amount)} USDT</span>
                      <a
                        href={`${BLOCK_EXPLORER}/tx/${item.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="view-tx"
                      >
                        View on Explorer
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Leaderboard />
          <HowItWorks />

          <div className="disconnect-section">
            <button onClick={disconnect} className="disconnect-button">
              Disconnect Wallet
            </button>
          </div>
        </div>
      </div>
      <ReferralsModal
        isOpen={showReferralsModal}
        onClose={() => setShowReferralsModal(false)}
        contract={contract}
        account={account}
        formatAddress={formatAddress}
      />
    </div>
  )
}

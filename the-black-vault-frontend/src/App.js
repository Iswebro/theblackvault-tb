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
          type: type,
          amount: formatEther(event.args.amount),
          time: new Date(block.timestamp * 1000),
          txHash: event.transactionHash,
        }
      }

      const allEventsPromises = [
        ...depositEvents.map((event) => processEvent(event, "Deposit")),
        ...rewardsWithdrawEvents.map((event) => processEvent(event, "Rewards Withdrawn")),
        ...referralWithdrawEvents.map((event) => processEvent(event, "Referral Withdrawal")),
      ]

      const processedEvents = await Promise.all(allEventsPromises)

      processedEvents.sort((a, b) => b.time.getTime() - a.time.getTime())
      setHistory(processedEvents)
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
      // Fetch BNB Balance
      const userBnbBalance = await provider.getBalance(account)
      setBalance(formatEther(userBnbBalance))
      console.log("Fetched BNB balance:", formatEther(userBnbBalance))

      // Fetch USDT Balance
      const userUsdtBalance = await usdt.balanceOf(account)
      setUsdtBalance(formatEther(userUsdtBalance))
      console.log("Fetched USDT balance:", formatEther(userUsdtBalance))

      // ... (rest of the function remains the same)
      const allowance = await usdt.allowance(account, CONTRACT_ADDRESS)
      setUsdtAllowance(formatEther(allowance))
      console.log("Fetched USDT allowance:", formatEther(allowance), "USDT")

      try {
        const vaultData = await vault.getUserVault(account)
        setRewards(formatEther(vaultData.pendingRewards))
        setVaultActiveAmount(formatEther(vaultData.activeAmount))
        console.log("Fetched vault rewards:", formatEther(vaultData.pendingRewards))
        console.log("Fetched vault active amount:", formatEther(vaultData.activeAmount))
      } catch (error) {
        console.log("No vault data found for user", error)
        setRewards("0")
        setVaultActiveAmount("0")
      }

      try {
        const refData = await vault.getUserReferralData(account)
        setReferralRewards(formatEther(refData.availableRewards))
        setReferralCount(refData.referredCount.toString())
        console.log("Fetched referral data:", {
          availableRewards: formatEther(refData.availableRewards),
          referredCount: refData.referredCount.toString(),
        })
      } catch (error) {
        console.log("No referral rewards found for user", error)
        setReferralRewards("0")
        setReferralCount("0")
      }

      if (referralAddress && referralAddress !== "0x0000000000000000000000000000000000000000") {
        try {
          const bonusInfo = await vault.getReferralBonusInfo(referralAddress, account)
          setReferralBonusesRemaining(bonusInfo.bonusesRemaining.toString())
          console.log("Fetched referral bonus info:", {
            bonusesUsed: bonusInfo.bonusesUsed.toString(),
            bonusesRemaining: bonusInfo.bonusesRemaining.toString(),
          })
        } catch (error) {
          console.log("No referral bonus info found", error)
          setReferralBonusesRemaining("3")
        }
      }

      try {
        const minDepositValue = await vault.MIN_DEPOSIT()
        setMinDeposit(formatEther(minDepositValue))
        console.log("Fetched MIN_DEPOSIT:", formatEther(minDepositValue), "USDT")
      } catch (error) {
        console.error("Error fetching MIN_DEPOSIT:", error)
        setMinDeposit("0")
      }

      await loadTransactionHistory(vault, usdt)
    } catch (error) {
      console.error("Error loading contract data:", error)
      addToast("Error loading data from contract", "error")
    }
  }

  const connectWallet = async () => {
    if (loading) return

    setLoading(true)
    try {
      // Reset the manual disconnect flag
      isManuallyDisconnected.current = false

      // Add a small delay to ensure wallet is ready
      await new Promise((resolve) => setTimeout(resolve, 100))

      console.log("Attempting to connect wallet...")
      const conn = await connectInjected()

      console.log("Connection successful:", conn.account)
      setProvider(conn.provider)
      setSigner(conn.signer)
      setAccount(conn.account)

      addToast("Wallet connected successfully!", "success")
    } catch (error) {
      console.error("Connection failed:", error)

      // Safe error handling
      let errorMessage = "Failed to connect wallet"

      if (error) {
        if (typeof error === "string") {
          errorMessage = error
        } else if (error.message) {
          errorMessage = error.message
        } else if (error.code) {
          errorMessage = `Wallet error (code: ${error.code})`
        }
      }

      // More user-friendly error messages
      if (errorMessage.includes("No wallet found")) {
        errorMessage = "Please use Trust Wallet's in-app browser or install MetaMask"
      } else if (errorMessage.includes("rejected") || errorMessage.includes("cancelled")) {
        errorMessage = "Connection cancelled. Please try again and approve the connection."
      } else if (errorMessage.includes("pending")) {
        errorMessage = "Connection already in progress. Please check your wallet app."
      }

      addToast(errorMessage, "error")
    } finally {
      setLoading(false)
    }
  }

  const approveUsdt = async () => {
    if (!usdtContract || txLoading || Number.parseFloat(depositAmount) <= 0) return

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
      if (error && error.code === 4001) {
        addToast("Transaction cancelled by user", "warning")
      } else {
        addToast("USDT approval failed. Please try again.", "error")
      }
    } finally {
      setTxLoading(false)
    }
  }

  const deposit = async () => {
    if (!contract || !depositAmount || txLoading || Number.parseFloat(depositAmount) <= 0) return

    if (Number.parseFloat(usdtAllowance) < Number.parseFloat(depositAmount)) {
      addToast("Please approve USDT first.", "error")
      return
    }

    setTxLoading(true)
    try {
      addToast("Processing deposit...", "info")

      const value = parseEther(depositAmount)

      let tx

      if (referralAddress && referralAddress !== "0x0000000000000000000000000000000000000000") {
        tx = await contract.depositWithReferrer(value, referralAddress)
      } else {
        tx = await contract.deposit(value)
      }

      addToast("Transaction submitted. Waiting for confirmation...", "info")
      await tx.wait()

      addToast("Deposit successful!", "success")
      setDepositAmount("")
      await loadContractData()
    } catch (error) {
      console.error("Deposit failed:", error)
      if (error && error.code === 4001) {
        addToast("Transaction cancelled by user", "warning")
      } else {
        addToast("Deposit failed. Please try again.", "error")
      }
    } finally {
      setTxLoading(false)
    }
  }

  const withdraw = async () => {
    if (!contract || txLoading) return

    setTxLoading(true)
    try {
      addToast("Processing withdrawal...", "info")
      const tx = await contract.withdrawRewards()

      addToast("Transaction submitted. Waiting for confirmation...", "info")
      await tx.wait()

      addToast("Rewards withdrawn successfully!", "success")
      await loadContractData()
    } catch (error) {
      console.error("Withdraw failed:", error)
      if (error && error.code === 4001) {
        addToast("Transaction cancelled by user", "warning")
      } else {
        addToast("Withdrawal failed. Please try again.", "error")
      }
    } finally {
      setTxLoading(false)
    }
  }

  const withdrawReferral = async () => {
    if (!contract || txLoading) return

    setTxLoading(true)
    try {
      addToast("Processing referral withdrawal...", "info")
      const tx = await contract.withdrawReferralRewards()

      addToast("Transaction submitted. Waiting for confirmation...", "info")
      await tx.wait()

      addToast("Referral rewards withdrawn successfully!", "success")
      await loadContractData()
    } catch (error) {
      console.error("Referral withdraw failed:", error)
      if (error && error.code === 4001) {
        addToast("Transaction cancelled by user", "warning")
      } else {
        addToast("Referral withdrawal failed. Please try again.", "error")
      }
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

  const formatAddress = (addr) => {
    if (!addr) return ""
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatAmount = (amount) => {
    const num = Number.parseFloat(amount)
    if (num === 0) return "0"
    if (num < 0.0001) return "< 0.0001"
    // Use toFixed(6) for consistent precision, then parseFloat to remove trailing zeros
    // and finally toString() to ensure it's a string for display.
    return Number.parseFloat(num.toFixed(6)).toString()
  }

  const handleMaxDeposit = () => {
    const maxAmount = Number.parseFloat(usdtBalance)
    if (maxAmount > 0) {
      setDepositAmount(maxAmount.toString())
    }
  }

  const getReferralLink = () => {
    const baseUrl = window.location.origin + window.location.pathname
    return `${baseUrl}?ref=${account}`
  }

  const copyReferralLink = () => {
    const link = getReferralLink()
    navigator.clipboard.writeText(link)
    addToast("Referral link copied to clipboard!", "success")
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
                <img
                  src={process.env.PUBLIC_URL + "/logo2.svg" || "/placeholder.svg"}
                  alt="Black Vault Logo"
                  className="premium-logo-img"
                />
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
                  <div className="loading-spinner"></div>
                  Connecting...
                </>
              ) : (
                "Connect Wallet"
              )}
            </button>

            <div style={{ marginTop: "1rem", textAlign: "center" }}>
              <p style={{ color: "#a0a0a0", fontSize: "0.9rem", marginBottom: "0.5rem" }}>For Trust Wallet users:</p>
              <p style={{ color: "#c0c0c0", fontSize: "0.8rem", lineHeight: "1.4" }}>
                1. Open Trust Wallet app
                <br />
                2. Go to DApps/Browser tab
                <br />
                3. Enter this website URL
                <br />
                4. Make sure you're on BSC Mainnet
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <div className="premium-background">
        <div className="bg-grid"></div>
        <div className="bg-gradient-1"></div>
        <div className="bg-gradient-2"></div>
        <div className="bg-particles"></div>
      </div>

      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="main-interface">
        {/* Header */}
        <div className="header">
          <div className="header-logo">
            <img
              src={process.env.PUBLIC_URL + "/logo2.svg" || "/placeholder.svg"}
              alt="Black Vault"
              className="mini-logo-img"
            />
            <span className="header-title">BLACK VAULT</span>
          </div>
          <div className="header-account">
            <span className="account-label">Connected</span>
            <span className="account-address">{formatAddress(account)}</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="vault-interface">
          {/* Balance Card */}
          <div className="vault-card premium-card">
            <h3 className="card-title">Vault Balance</h3>
            <div className="balance-grid">
              <div className="balance-item">
                <span className="balance-label">USDT Balance</span>
                <span className="balance-value">{formatAmount(vaultActiveAmount)} USDT</span>
              </div>
            </div>
          </div>

          {/* Deposit Card */}
          <div className="vault-card premium-card">
            <h3 className="card-title">
              <span className="card-icon">💰</span>
              Make Deposit
            </h3>

            {referralAddress !== "0x0000000000000000000000000000000000000000" && (
              <div className="referral-info">
                <span className="referral-label">Referral:</span>
                <span className="referral-address">{formatAddress(referralAddress)}</span>
              </div>
            )}

            <div className="wallet-balance">
              <span className="balance-label">Wallet Balance:</span>
              <span className="balance-value">{formatAmount(usdtBalance)} USDT</span>
              <button className="max-button" onClick={handleMaxDeposit}>
                Max
              </button>
            </div>

            {showDisclaimer && (
              <div className="disclaimer-box">
                <button
                  className="disclaimer-close"
                  onClick={() => setShowDisclaimer(false)}
                  aria-label="Hide disclaimer"
                >
                  ×
                </button>
                <p className="disclaimer-title">IMPORTANT DISCLAIMER</p>
                <p className="disclaimer-text">
                  This platform exclusively uses <strong>USDT (BEP-20)</strong> on the{" "}
                  <strong>Binance Smart Chain (BSC)</strong>. Depositing any other token or using a different network
                  will result in permanent loss of funds. Ensure your wallet is connected to the BSC Mainnet and you are
                  depositing BEP-20 USDT.
                </p>
              </div>
            )}

            <div className="input-group">
              <input
                type="number"
                id="deposit-amount"
                name="deposit-amount"
                required
                className="vault-input premium-input"
                placeholder={
                  minDeposit !== "0" ? `Min. deposit ${formatAmount(minDeposit)} USDT` : "Min. deposit: 50 USDT"
                }
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                step="0.001"
                min="0"
              />

              <button
                className="vault-button premium-button primary"
                onClick={approveUsdt}
                disabled={txLoading || !depositAmount || Number.parseFloat(depositAmount) <= 0}
              >
                {txLoading ? (
                  <>
                    <div className="loading-spinner"></div>
                    Approving USDT...
                  </>
                ) : (
                  "Approve USDT"
                )}
              </button>
              <button
                className="vault-button premium-button primary"
                onClick={deposit}
                disabled={txLoading || !depositAmount || Number.parseFloat(depositAmount) <= 0 || needsApproval}
              >
                {txLoading ? (
                  <>
                    <div className="loading-spinner"></div>
                    Processing...
                  </>
                ) : (
                  "Deposit USDT"
                )}
              </button>
            </div>
          </div>

          {/* Vault Rewards */}
          <div className="vault-card premium-card">
            <h3 className="card-title">
              <span className="card-icon">🎁</span>
              Vault Rewards
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

          {/* Referral Rewards */}
          <div className="vault-card premium-card">
            <h3 className="card-title">
              <span className="card-icon">👥</span>
              Referral Rewards
            </h3>
            <div className="reward-display">
              <span className="reward-amount purple">{formatAmount(referralRewards)} USDT</span>
              <span className="reward-label">From referrals</span>
            </div>
            <div className="referral-stats">
              <span className="referral-label">Referrals:</span>
              <span className="referral-value">{referralCount}</span>
            </div>

            <div className="referral-actions">
              <button className="copy-link-button" onClick={copyReferralLink}>
                Copy Referral Link
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
              {txLoading ? "Processing..." : "Withdraw Referral"}
            </button>
          </div>

          {/* Transaction History */}
          <div className="vault-card premium-card">
            <h3 className="card-title">
              <span className="card-icon">📊</span>
              Transaction History
            </h3>

            {history.length === 0 ? (
              <div className="empty-state">
                <p className="empty-message">No transactions yet</p>
                <p className="empty-submessage">Your deposits and withdrawals will appear here</p>
              </div>
            ) : (
              <div className="history-list">
                {history.map((item, index) => (
                  <div key={index} className="history-item">
                    <div className="history-info">
                      <div className={`history-dot ${item.type.toLowerCase().replace(/\s+/g, "-")}`}></div>
                      <div className="history-details">
                        <span className="history-type">{item.type}</span>
                        <span className="history-time">
                          {item.time.toLocaleDateString()} {item.time.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    <div className="history-amount">
                      <span className="amount-value">{formatAmount(item.amount)} USDT</span>
                      <a
                        href={`${process.env.REACT_APP_BLOCK_EXPLORER}/tx/${item.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="view-tx"
                      >
                        View
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Weekly Giveaway Banner */}
          <div className="vault-card premium-card">
            <div className="text-center p-4 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black rounded-lg mb-4">
              🎉 Weekly USDT Giveaway for Top 3 referrers is coming soon! Stay Tuned.
            </div>
          </div>

          {/* Leaderboard Section */}
          <Leaderboard />

          {/* How It Works Section */}
          <HowItWorks />

          {/* Disconnect Button */}
          <div className="disconnect-section">
            <button onClick={disconnect} className="disconnect-button">
              Disconnect Wallet
            </button>
          </div>
        </div>
      </div>

      {/* Referrals Modal */}
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

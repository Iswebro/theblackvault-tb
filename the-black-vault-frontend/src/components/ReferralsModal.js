"use client"

import { useState, useEffect } from "react"

export default function ReferralsModal({ isOpen, onClose, contract, account, formatAddress }) {
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(false)
  const [totalReferralCount, setTotalReferralCount] = useState(0)
  const [uniqueReferrals, setUniqueReferrals] = useState(0)

  useEffect(() => {
    if (isOpen && contract && account) {
      loadReferrals()
    }
  }, [isOpen, contract, account])

  const loadReferrals = async () => {
    if (!contract || !account) return

    setLoading(true)
    try {
      // Get referral data from contract (this gives us total referral count)
      const referralData = await contract.getUserReferralData(account)
      const totalCount = referralData[2]?.toString() || "0"
      setTotalReferralCount(totalCount)

      // Get all deposit events where this user is the referrer
      const depositFilter = contract.filters.Deposited(null, null, account)
      const depositEvents = await contract.queryFilter(depositFilter, -50000) // Last 50k blocks

      // Extract unique referee addresses
      const uniqueReferees = [...new Set(depositEvents.map((event) => event.args.user.toLowerCase()))]
      setUniqueReferrals(uniqueReferees.length)

      // Get bonus info for each referee
      const referralData2 = await Promise.all(
        uniqueReferees.map(async (refereeAddress) => {
          try {
            const bonusInfo = await contract.getReferralBonusInfo(account, refereeAddress)
            return {
              address: refereeAddress,
              bonusesUsed: bonusInfo.bonusesUsed.toString(),
              bonusesRemaining: bonusInfo.bonusesRemaining.toString(),
            }
          } catch (error) {
            console.error(`Error getting bonus info for ${refereeAddress}:`, error)
            return {
              address: refereeAddress,
              bonusesUsed: "0",
              bonusesRemaining: "3",
            }
          }
        }),
      )

      setReferrals(referralData2)
    } catch (error) {
      console.error("Error loading referrals:", error)
      setReferrals([])
      setTotalReferralCount(0)
      setUniqueReferrals(0)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            <span className="modal-icon">👥</span>
            Your Referrals
          </h3>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>

        <div className="modal-body">
          {!loading && (
            <div className="referral-stats-summary" style={{ marginBottom: '16px', padding: '12px', background: '#222', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#ccc' }}>Total Referral Deposits:</span>
                <span style={{ color: '#fff', fontWeight: 'bold' }}>{totalReferralCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#ccc' }}>Unique Referrals:</span>
                <span style={{ color: '#fff', fontWeight: 'bold' }}>{uniqueReferrals}</span>
              </div>
            </div>
          )}
          
          {loading ? (
            <div className="modal-loading">
              <div className="loading-spinner"></div>
              <p>Loading referrals...</p>
            </div>
          ) : referrals.length === 0 ? (
            <div className="modal-empty">
              <p className="empty-message">No unique referrals yet</p>
              <p className="empty-submessage">
                {totalReferralCount > 0 
                  ? `You have ${totalReferralCount} total referral deposits, but they may be from the same addresses making multiple deposits.`
                  : "Share your referral link to start earning bonuses!"
                }
              </p>
            </div>
          ) : (
            <div className="referrals-list">
              <div className="referrals-header">
                <span className="referral-col-address">Address</span>
                <span className="referral-col-bonuses">Bonuses Remaining</span>
              </div>
              {referrals.map((referral, index) => (
                <div key={index} className="referral-row">
                  <span className="referral-address">{formatAddress(referral.address)}</span>
                  <span className="referral-bonuses">{referral.bonusesRemaining}/3</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

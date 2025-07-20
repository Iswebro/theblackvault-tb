"use client"

import { useState, useEffect } from "react"

export default function ReferralsModal({ 
  isOpen, 
  onClose, 
  contract, 
  account, 
  formatAddress,
  isDefaultReferrer = false
}) {
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(false)
  const [totalReferralCount, setTotalReferralCount] = useState(0)
  const [uniqueReferrals, setUniqueReferrals] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // Helper function to query events with rate limiting and retry logic
  const queryEventsWithRetry = async (contract, filter, blockRanges = [-20000, -8000, -3000]) => {
    for (let i = 0; i < blockRanges.length; i++) {
      const blockRange = blockRanges[i];
      try {
        console.log(`🔍 DEBUG: Modal trying event query with ${Math.abs(blockRange)}k block range...`);
        if (i > 0) {
          // Add delay between retries to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000 * i));
        }
        const events = await contract.queryFilter(filter, blockRange);
        console.log(`🔍 DEBUG: Modal successfully found ${events.length} events with ${Math.abs(blockRange)}k range`);
        return events;
      } catch (error) {
        console.warn(`⚠️ Modal event query failed with ${Math.abs(blockRange)}k range:`, error.message);
        if (i === blockRanges.length - 1) {
          console.error("❌ Modal: All event query attempts failed");
          return [];
        }
      }
    }
    return [];
  };

  useEffect(() => {
    if (isOpen && contract && account) {
      setCurrentPage(1) // Reset to page 1 when modal opens
      loadReferrals()
    }
  }, [isOpen, contract, account])

  const loadReferrals = async () => {
    if (!contract || !account) return

    setLoading(true)
    try {
      console.log("🔍 DEBUG: Modal loading referrals for account:", account);
      
      // Get referral data from contract (this gives us total referral count)
      const referralData = await contract.getUserReferralData(account)
      const totalCount = referralData[2]?.toString() || "0"
      setTotalReferralCount(totalCount)
      console.log("🔍 DEBUG: Modal total referral count:", totalCount);

      // Get all deposit events where this user is the referrer (using rate limiting)
      const depositFilter = contract.filters.Deposited(null, null, account)
      console.log("🔍 DEBUG: Modal searching for deposit events...");
      
      const depositEvents = await queryEventsWithRetry(contract, depositFilter, [-20000, -8000, -3000]);
      console.log("🔍 DEBUG: Modal deposit events found:", depositEvents.length);

      // Extract unique referee addresses
      const uniqueReferees = [...new Set(depositEvents.map((event) => event.args.user.toLowerCase()))]
      setUniqueReferrals(uniqueReferees.length)
      console.log("🔍 DEBUG: Modal unique referees:", uniqueReferees.length);

      if (uniqueReferees.length === 0) {
        setReferrals([])
        return
      }

      // Get bonus info for each referee
      console.log("🔍 DEBUG: Modal getting bonus info for each referee...");
      const referralData2 = await Promise.all(
        uniqueReferees.map(async (refereeAddress) => {
          try {
            const bonusInfo = await contract.getReferralBonusInfo(account, refereeAddress)
            return {
              address: refereeAddress,
              bonusesUsed: parseInt(bonusInfo.used.toString()),
              bonusesRemaining: parseInt(bonusInfo.remaining.toString()),
            }
          } catch (error) {
            console.error(`Error getting bonus info for ${refereeAddress}:`, error)
            return {
              address: refereeAddress,
              bonusesUsed: 0,
              bonusesRemaining: 3,
            }
          }
        }),
      )

      console.log("🔍 DEBUG: Modal final referral data:", referralData2);
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

  // Pagination logic
  const totalPages = Math.ceil(referrals.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedReferrals = referrals.slice(startIndex, endIndex)

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1))
  }

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            <span className="modal-icon">👥</span>
            {isDefaultReferrer ? 'All Referrals (Including Default)' : 'Your Referrals'}
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
                  ? `${isDefaultReferrer ? 'There are' : 'You have'} ${totalReferralCount} total referral deposits, but they may be from the same addresses making multiple deposits.`
                  : isDefaultReferrer ? "No users have deposited yet." : "Share your referral link to start earning bonuses!"
                }
              </p>
            </div>          ) : (
            <div className="referrals-list">
              <div className="referrals-header">
                <span className="referral-col-address">Address</span>
                <span className="referral-col-bonuses">Rewards Used</span>
              </div>
              {paginatedReferrals.map((referral, index) => (
                <div key={index} className="referral-row">
                  <span className="referral-address">{formatAddress(referral.address)}</span>
                  <span className="referral-bonuses">{referral.bonusesUsed}/3</span>
                </div>
              ))}

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div style={{ 
                  display: "flex", 
                  justifyContent: "center", 
                  alignItems: "center", 
                  marginTop: "16px", 
                  gap: "12px" 
                }}>
                  <button
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                    style={{ 
                      padding: "6px 12px", 
                      borderRadius: 6, 
                      border: "none", 
                      background: currentPage === 1 ? "#444" : "#666", 
                      color: "#fff", 
                      cursor: currentPage === 1 ? "not-allowed" : "pointer" 
                    }}
                  >
                    Previous
                  </button>
                  <span style={{ color: "#fff", fontSize: "14px" }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    style={{ 
                      padding: "6px 12px", 
                      borderRadius: 6, 
                      border: "none", 
                      background: currentPage === totalPages ? "#444" : "#666", 
                      color: "#fff", 
                      cursor: currentPage === totalPages ? "not-allowed" : "pointer" 
                    }}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

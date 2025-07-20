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

  // Fetch detailed list of users who made deposits without referrals (for default referrer)
  const fetchDefaultReferrerDetailedList = async () => {
    if (!contract) return;
    
    console.log("🔍 DEBUG: Fetching detailed no-referral deposits list...");
    
    try {
      // Get all deposit events to find users who deposited without referrals
      const depositFilter = contract.filters.Deposited();
      
      // Use the same retry logic as the main app
      const queryEventsWithRetry = async (filter, blockRanges = [-50000, -25000, -10000]) => {
        for (let i = 0; i < blockRanges.length; i++) {
          const blockRange = blockRanges[i];
          try {
            console.log(`🔍 DEBUG: Modal trying ${Math.abs(blockRange)}k block range...`);
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 500 * i));
            }
            const events = await contract.queryFilter(filter, blockRange);
            console.log(`🔍 DEBUG: Modal found ${events.length} events with ${Math.abs(blockRange)}k range`);
            return events;
          } catch (error) {
            console.warn(`⚠️ DEBUG: Modal event query failed with ${Math.abs(blockRange)}k range:`, error.message);
            if (i === blockRanges.length - 1) {
              return [];
            }
          }
        }
        return [];
      };
      
      let depositEvents = await queryEventsWithRetry(depositFilter, [-50000, -25000, -10000]);
      
      // If no recent events, try from deployment
      if (depositEvents.length === 0) {
        console.log("🔍 DEBUG: Modal no recent events, trying from deployment...");
        try {
          depositEvents = await contract.queryFilter(depositFilter, 42296467);
          console.log(`🔍 DEBUG: Modal found ${depositEvents.length} historical events`);
        } catch (error) {
          console.warn("⚠️ DEBUG: Modal historical query failed:", error.message);
        }
      }
      
      // Filter events for deposits without referrals (zero address or default referrer)
      const DEFAULT_REFERRER = '0x706961C676FE743C34A867437661D13E16ADCbEc';
      const noReferralEvents = depositEvents.filter(event => {
        const referrer = event.args?.referrer?.toLowerCase();
        return referrer === '0x0000000000000000000000000000000000000000' || 
               referrer === DEFAULT_REFERRER.toLowerCase();
      });
      
      console.log(`🔍 DEBUG: Modal found ${noReferralEvents.length} no-referral deposit events`);
      
      // Get unique users who made deposits without referrals
      const uniqueNoReferralUsers = [...new Set(noReferralEvents.map(event => event.args.user.toLowerCase()))];
      console.log(`🔍 DEBUG: Modal found ${uniqueNoReferralUsers.length} unique no-referral users`);
      
      // Get bonus info for each user
      const maxUsersToProcess = 50; // Limit to prevent excessive RPC calls
      const usersToProcess = uniqueNoReferralUsers.slice(0, maxUsersToProcess);
      
      const noReferralUserData = await Promise.all(
        usersToProcess.map(async (userAddress) => {
          try {
            // For no-referral users, we check how many bonuses they would have gotten from default referrer
            const bonusInfo = await contract.getReferralBonusInfo(DEFAULT_REFERRER, userAddress);
            return {
              address: userAddress,
              bonusesUsed: parseInt(bonusInfo.used.toString()),
              bonusesRemaining: parseInt(bonusInfo.remaining.toString()),
            };
          } catch (error) {
            console.warn(`⚠️ DEBUG: Modal error getting bonus info for ${userAddress}:`, error.message);
            return {
              address: userAddress,
              bonusesUsed: 0,
              bonusesRemaining: 3,
            };
          }
        })
      );
      
      console.log("🔍 DEBUG: Modal no-referral user data:", noReferralUserData);
      setReferrals(noReferralUserData);
      
    } catch (error) {
      console.error("❌ DEBUG: Modal error fetching no-referral detailed list:", error);
      setReferrals([]);
    }
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
      
      // Try to use cached background job data first (fast and reliable)
      let referralDataFetched = false;
      try {
        // Use different endpoint based on whether this is the default referrer
        const apiUrl = isDefaultReferrer 
          ? `/api/referral-stats?type=default`
          : `/api/user-referrals?account=${account}`;
        
        console.log("🔍 DEBUG: Modal fetching from:", apiUrl, "isDefaultReferrer:", isDefaultReferrer);
        
        const response = await fetch(apiUrl);
        if (response.ok) {
          const apiData = await response.json();
          console.log("🔍 DEBUG: Modal cached referral API response:", apiData);
          
          if (isDefaultReferrer && apiData.result && apiData.result.stats) {
            // Default referrer case - use the "no referral" stats
            const { stats } = apiData.result;
            
            console.log("🔍 DEBUG: Modal using cached default referrer data:", {
              dataSource: "background-job-default",
              totalReferrals: stats.totalReferrals,
              uniqueReferrals: stats.uniqueReferrals
            });
            
            setTotalReferralCount(stats.totalReferrals || "0");
            setUniqueReferrals(stats.uniqueReferrals || 0);
            
            // For default referrer, show the "no referral" deposits
            setReferrals([]); // These are "no referral" users, we'll fetch them separately
            
            console.log("🔍 DEBUG: Modal default referrer stats set successfully");
            referralDataFetched = true;
            
            // Now fetch the detailed list of users who deposited without referrals
            try {
              console.log("🔍 DEBUG: Fetching detailed no-referral users list...");
              await fetchDefaultReferrerDetailedList();
            } catch (detailError) {
              console.warn("⚠️ DEBUG: Failed to fetch detailed no-referral list:", detailError.message);
            }
            
          } else if (!isDefaultReferrer && apiData.result && apiData.result.contractData) {
            // Regular user case - use the user-referrals data
            const { contractData, events, stats } = apiData.result;
            
            console.log("🔍 DEBUG: Modal using cached user referral data:", {
              dataSource: "background-job-user",
              totalReferrals: contractData.referredCount,
              uniqueReferrals: stats.uniqueReferrals,
              eventsCount: events.totalEvents
            });
            
            setTotalReferralCount(contractData.referredCount || "0");
            setUniqueReferrals(stats.uniqueReferrals || 0);
            
            // For regular users, show their referee details
            if (apiData.result.referrals && apiData.result.referrals.length > 0) {
              setReferrals(apiData.result.referrals);
            } else {
              setReferrals([]);
            }
            
            console.log("🔍 DEBUG: Modal cached stats set successfully");
            referralDataFetched = true;
          }
        } else if (response.status === 404) {
          // User not found in cache - they might not have any referrals
          console.log("🔍 DEBUG: Modal user not found in cache (likely no referrals), setting empty data");
          setTotalReferralCount("0");
          setUniqueReferrals(0);
          setReferrals([]);
          referralDataFetched = true;
        } else {
          console.warn("⚠️ Modal: API error, using fallback. Status:", response.status);
        }
      } catch (cacheError) {
        console.warn("⚠️ Modal: Cached API error, using fallback:", cacheError.message);
      }
      
      // Fallback to original API or direct RPC calls
      if (!referralDataFetched) {
        console.log("🔍 DEBUG: Modal fallback - trying original API...");
        
        // Try to use original API endpoint first to reduce RPC rate limiting
        try {
          const response = await fetch(`/api/user-referrals?account=${account}`);
          if (response.ok) {
            const apiData = await response.json();
            console.log("🔍 DEBUG: Modal API response:", apiData);
            
            if (apiData.result) {
              const { contractData, stats, referrals: apiReferrals, events } = apiData.result;
              
              console.log("🔍 DEBUG: Modal using API data:", {
                totalCount: stats.totalReferralCount,
                uniqueCount: stats.uniqueReferrals,
                apiReferrals: apiReferrals.length,
                dataSource: apiData.cached ? "Redis cache" : "Fresh RPC query"
              });
              
              setTotalReferralCount(stats.totalReferralCount || "0");
              setUniqueReferrals(stats.uniqueReferrals || 0);
              setReferrals(apiReferrals || []);
              
              if (events.truncated) {
                console.log("⚠️ DEBUG: Modal data was truncated due to large number of referrals");
              }
              
              return; // Successfully used API data
            }
          } else {
            console.warn("⚠️ Modal API endpoint failed, falling back to direct RPC");
          }
        } catch (apiError) {
          console.warn("⚠️ Modal API error, falling back to direct RPC:", apiError.message);
        }
        
        // Final fallback to direct RPC calls
        console.log("🔍 DEBUG: Modal falling back to direct contract calls...");
        
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

        // Get bonus info for each referee (limit to prevent excessive RPC calls)
        const maxRefereesToProcess = 15; // Reduced limit for fallback
        const refereesToProcess = uniqueReferees.slice(0, maxRefereesToProcess);
        
        console.log("🔍 DEBUG: Modal getting bonus info for each referee...");
        console.log(`🔍 DEBUG: Processing ${refereesToProcess.length} of ${uniqueReferees.length} referees`);
        
        const referralData2 = await Promise.all(
          refereesToProcess.map(async (refereeAddress) => {
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
        if (uniqueReferees.length > maxRefereesToProcess) {
          console.log(`⚠️ DEBUG: Modal truncated referrals due to limit (${maxRefereesToProcess}/${uniqueReferees.length})`);
        }
        setReferrals(referralData2)
      }
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

// src/components/WeeklyChallenge.js
import React, { useState, useEffect } from 'react';

const WeeklyChallenge = ({ walletAddress, vaultContract, isConnected }) => {
  const [currentWeek, setCurrentWeek] = useState(null);
  const [userStats, setUserStats] = useState({
    position: 0,
    weeklyEarnings: 0,
    totalReferrals: 0,
    isParticipating: false
  });
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Show welcome modal when wallet connects (only if competition is active)
  useEffect(() => {
    console.log('Welcome modal check:', { 
      isConnected, 
      walletAddress: !!walletAddress, 
      hasShownWelcome, 
      currentWeek: currentWeek ? { isPreLaunch: currentWeek.isPreLaunch } : null 
    });
    
    // Check localStorage for "don't show again" preference
    const dontShowPref = localStorage.getItem('weeklyChallenge_dontShowWelcome');
    
    // Show modal when wallet connects, if user hasn't disabled it
    if (isConnected && walletAddress && !hasShownWelcome && currentWeek && dontShowPref !== 'true') {
      console.log('Showing welcome modal');
      setShowWelcomeModal(true);
      setHasShownWelcome(true);
    }
  }, [isConnected, walletAddress, currentWeek, hasShownWelcome]);

  console.log('WeeklyChallenge component rendered', { 
    walletAddress, 
    isConnected, 
    showWelcomeModal, 
    hasShownWelcome,
    currentWeek: currentWeek ? { isPreLaunch: currentWeek.isPreLaunch } : null
  });

  // Calculate current week period and countdown using the same logic as the weekly leaderboard
  useEffect(() => {
    const calculateCurrentWeek = () => {
      const LAUNCH_TIMESTAMP = 1755118800; // August 14, 2025 07:00 AEST Brisbane time - Official Competition Launch
      const WEEK_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds
      const nowTs = Math.floor(Date.now() / 1000);
      
      // Check if we're before the launch
      if (nowTs < LAUNCH_TIMESTAMP) {
        return {
          start: new Date(LAUNCH_TIMESTAMP * 1000),
          end: new Date((LAUNCH_TIMESTAMP + WEEK_DURATION) * 1000),
          index: -1, // Pre-launch
          isPreLaunch: true
        };
      }
      
      const weekIndex = Math.floor((nowTs - LAUNCH_TIMESTAMP) / WEEK_DURATION);
      
      // Calculate start and end of current week
      const weekStart = LAUNCH_TIMESTAMP + weekIndex * WEEK_DURATION;
      const weekEnd = weekStart + WEEK_DURATION;
      
      return {
        start: new Date(weekStart * 1000),
        end: new Date(weekEnd * 1000),
        index: weekIndex,
        isPreLaunch: false
      };
    };

    const week = calculateCurrentWeek();
    setCurrentWeek(week);

    // Update countdown every second
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const targetTime = week.isPreLaunch ? week.start.getTime() : week.end.getTime();
      const distance = targetTime - now;

      if (distance > 0) {
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000)
        });
      } else {
        // Time has ended, recalculate
        const newWeek = calculateCurrentWeek();
        setCurrentWeek(newWeek);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Fetch weekly challenge data
  useEffect(() => {
    if (!currentWeek) return;

    const fetchChallengeData = async () => {
      try {
        setIsLoading(true);
        
        // If we're in pre-launch mode, don't fetch data yet
        if (currentWeek.isPreLaunch) {
          setLeaderboardData([]);
          setUserStats({
            position: 0,
            weeklyEarnings: 0,
            totalReferrals: 0,
            isParticipating: false
          });
          setIsLoading(false);
          return;
        }
        
        // In real implementation, this would fetch actual user data from your backend/contract
        // For now, showing empty state until real data is available
        setLeaderboardData([]);
        setUserStats({
          position: 0,
          weeklyEarnings: 0,
          totalReferrals: 0,
          isParticipating: false
        });
      } catch (error) {
        console.error('Error fetching challenge data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChallengeData();
  }, [currentWeek, isConnected, walletAddress]);

  if (!currentWeek) {
    return (
      <div style={{ 
        padding: '2rem', 
        margin: '2rem 0', 
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', 
        borderRadius: '16px',
        textAlign: 'center',
        color: 'white',
        border: '3px solid #ffd700',
        minHeight: '200px'
      }}>
        <h2 style={{ color: '#ffd700', marginBottom: '1rem' }}>🎯 Weekly Challenge Loading...</h2>
        <p>Initializing weekly referral challenge...</p>
      </div>
    );
  }

  return (
    <div className="weekly-challenge" style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      borderRadius: '16px',
      padding: '2rem',
      margin: '2rem 0',
      border: '3px solid #ffd700',
      color: 'white',
      maxWidth: '100%',
      overflow: 'hidden'
    }}>
      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{ color: '#ffd700', fontSize: 'clamp(1.5rem, 4vw, 2rem)', marginBottom: '1rem' }}>
          🎯 Weekly Referral Challenge
        </h2>
        <div style={{ 
          background: 'rgba(255, 215, 0, 0.1)', 
          padding: '1rem', 
          borderRadius: '12px',
          border: '2px solid #ffd700',
          marginBottom: '1.5rem',
          maxWidth: '400px',
          margin: '0 auto 1.5rem auto'
        }}>
          <h3 style={{ color: '#ffd700', margin: '0 0 0.5rem 0', fontSize: 'clamp(1rem, 3vw, 1.25rem)' }}>💰 $50 USDT Prize Pool</h3>
          <p style={{ margin: '0', opacity: 0.9, fontSize: '0.9rem' }}>
            {currentWeek.isPreLaunch ? 'Competition launches soon!' : 'Compete this week for your share!'}
          </p>
        </div>
        
        {/* Countdown Timer */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: 'clamp(0.5rem, 2vw, 1rem)', 
          marginBottom: '1.5rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ 
            fontSize: '0.9rem', 
            color: '#ffd700', 
            marginBottom: '0.5rem', 
            width: '100%',
            fontWeight: 'bold'
          }}>
            {currentWeek.isPreLaunch ? '🚀 Competition Starts In:' : '⏰ Week Ends In:'}
          </div>
          {['days', 'hours', 'minutes', 'seconds'].map((unit) => (
            <div key={unit} style={{
              background: 'rgba(255, 255, 255, 0.1)',
              padding: 'clamp(0.5rem, 1.5vw, 0.75rem)',
              borderRadius: '8px',
              minWidth: 'clamp(50px, 12vw, 60px)',
              border: '1px solid rgba(255, 215, 0, 0.3)'
            }}>
              <div style={{ fontSize: 'clamp(0.9rem, 3vw, 1.2rem)', fontWeight: 'bold', color: '#ffd700' }}>
                {timeLeft[unit]}
              </div>
              <div style={{ fontSize: 'clamp(0.6rem, 1.5vw, 0.75rem)', textTransform: 'uppercase', opacity: 0.8 }}>
                {unit}
              </div>
            </div>
          ))}
        </div>

        {isConnected && !currentWeek.isPreLaunch && userStats.isParticipating && (
          <div style={{ 
            background: 'rgba(255, 215, 0, 0.1)', 
            padding: '1rem', 
            borderRadius: '8px',
            display: 'inline-block',
            border: '1px solid rgba(255, 215, 0, 0.3)',
            maxWidth: '100%'
          }}>
            <p style={{ margin: '0', fontSize: 'clamp(0.8rem, 2vw, 0.9rem)' }}>
              Your Position: <span style={{ color: '#ffd700', fontWeight: 'bold' }}>#{userStats.position}</span> | 
              Weekly Earnings: <span style={{ color: '#00ff88', fontWeight: 'bold' }}>${userStats.weeklyEarnings}</span>
            </p>
          </div>
        )}

        {/* Debug button - remove this later */}
        {isConnected && (
          <div style={{ marginTop: '1rem' }}>
            <button 
              onClick={() => {
                console.log('Test modal button clicked');
                setShowWelcomeModal(true);
              }}
              style={{
                padding: '0.5rem 1rem',
                background: '#ff6b6b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              Test Modal (Debug)
            </button>
          </div>
        )}
      </div>

      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem'
      }}>
        {/* User Progress - Now First */}
        <div style={{ minWidth: 0 }}>
          <h3 style={{ color: '#ffd700', marginBottom: '1rem', fontSize: '1.25rem' }}>
            {currentWeek.isPreLaunch ? '� Get Ready!' : '�📊 Your Progress'}
          </h3>
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid rgba(255, 215, 0, 0.2)'
          }}>
            {currentWeek.isPreLaunch ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🏁</div>
                <h4 style={{ color: '#ffd700', marginBottom: '1rem', fontSize: '1.1rem' }}>Competition Not Started Yet</h4>
                <p style={{ opacity: 0.8, marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  The weekly referral challenge will begin when the countdown reaches zero. 
                  Get ready to compete for $50 USDT in prizes!
                </p>
                <div style={{
                  background: 'rgba(255, 215, 0, 0.1)',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  marginBottom: '1rem'
                }}>
                  <p style={{ margin: '0', fontSize: '0.9rem', fontWeight: 'bold', color: '#ffd700' }}>
                    Competition starts: {currentWeek.start.toLocaleDateString()} at {currentWeek.start.toLocaleTimeString()}
                  </p>
                </div>
                <button 
                  onClick={() => setShowRules(true)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'linear-gradient(45deg, #ffd700, #ffed4e)',
                    color: '#1a1a2e',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'transform 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                  onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                >
                  📖 View Rules
                </button>
              </div>
            ) : isConnected ? (
              userStats.isParticipating ? (
                <>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '1.75rem', color: '#ffd700', fontWeight: 'bold', textAlign: 'center' }}>
                      #{userStats.position}
                    </div>
                    <div style={{ textAlign: 'center', opacity: 0.8, fontSize: '0.9rem' }}>Current Position</div>
                  </div>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span>Weekly Earnings</span>
                      <span style={{ color: '#00ff88', fontWeight: 'bold' }}>${userStats.weeklyEarnings}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <span>Referrals This Week</span>
                      <span style={{ color: '#ffd700', fontWeight: 'bold' }}>{userStats.totalReferrals}</span>
                    </div>
                  </div>

                  <div style={{
                    background: 'rgba(255, 215, 0, 0.1)',
                    padding: '1rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    border: '1px solid rgba(255, 215, 0, 0.3)'
                  }}>
                    <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Prize Potential:</div>
                    <div style={{ color: '#ffd700', fontWeight: 'bold', fontSize: '1rem' }}>
                      {userStats.position <= 3 ? `$${(50 * (4 - userStats.position) / 6).toFixed(2)}` : 'Keep climbing!'}
                    </div>
                  </div>

                  <button 
                    onClick={() => setShowRules(true)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'linear-gradient(45deg, #ffd700, #ffed4e)',
                      color: '#1a1a2e',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'transform 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                  >
                    📖 View Rules
                  </button>
                </>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🚀</div>
                  <h4 style={{ color: '#ffd700', marginBottom: '1rem', fontSize: '1.1rem' }}>Ready to Compete!</h4>
                  <p style={{ opacity: 0.8, marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: '1.5' }}>
                    Your wallet is connected! Start referring friends to participate in this week's challenge 
                    and compete for $50 USDT in prizes.
                  </p>
                  <div style={{
                    background: 'rgba(0, 255, 136, 0.1)',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(0, 255, 136, 0.3)',
                    marginBottom: '1rem'
                  }}>
                    <p style={{ margin: '0', fontSize: '0.9rem', fontWeight: 'bold', color: '#00ff88' }}>
                      Make your first referral to join the leaderboard!
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowRules(true)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'linear-gradient(45deg, #ffd700, #ffed4e)',
                      color: '#1a1a2e',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'transform 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                  >
                    📖 View Rules
                  </button>
                </div>
              )
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔗</div>
                <p style={{ opacity: 0.8, marginBottom: '1rem', fontSize: '0.9rem' }}>Connect your wallet to participate!</p>
                <div style={{
                  background: 'rgba(255, 215, 0, 0.1)',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 215, 0, 0.3)'
                }}>
                  <p style={{ margin: '0', fontSize: '0.9rem' }}>Join the weekly competition and earn USDT rewards!</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Leaderboard - Now Second */}
        <div style={{ minWidth: 0 }}>
          <h3 style={{ color: '#ffd700', marginBottom: '1rem', fontSize: '1.25rem' }}>
            {currentWeek.isPreLaunch ? '🏆 Prize Pool' : '🏆 Live Leaderboard'}
          </h3>
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid rgba(255, 215, 0, 0.2)'
          }}>
            {currentWeek.isPreLaunch ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>💰</div>
                <h4 style={{ color: '#ffd700', marginBottom: '1rem', fontSize: '1.1rem' }}>$50 USDT Weekly Prize Pool</h4>
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', padding: '0.5rem', background: 'rgba(255, 215, 0, 0.1)', borderRadius: '6px' }}>
                    <span>🥇 1st Place</span>
                    <span style={{ color: '#ffd700', fontWeight: 'bold' }}>$25 USDT</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', padding: '0.5rem', background: 'rgba(192, 192, 192, 0.1)', borderRadius: '6px' }}>
                    <span>🥈 2nd Place</span>
                    <span style={{ color: '#c0c0c0', fontWeight: 'bold' }}>$15 USDT</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(205, 127, 50, 0.1)', borderRadius: '6px' }}>
                    <span>🥉 3rd Place</span>
                    <span style={{ color: '#cd7f32', fontWeight: 'bold' }}>$10 USDT</span>
                  </div>
                </div>
                <p style={{ opacity: 0.8, fontSize: '0.9rem', margin: '0' }}>
                  Compete for the most referrals when the challenge begins!
                </p>
              </div>
            ) : (
              leaderboardData.length > 0 ? (
                leaderboardData.map((user, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem',
                    borderBottom: index < leaderboardData.length - 1 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                    background: user.rank <= 3 ? `rgba(255, 215, 0, ${0.1 - index * 0.02})` : 'transparent'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
                      <span style={{ 
                        fontSize: '1.1rem',
                        color: user.rank === 1 ? '#ffd700' : user.rank === 2 ? '#c0c0c0' : user.rank === 3 ? '#cd7f32' : '#fff',
                        flexShrink: 0
                      }}>
                        {user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : `#${user.rank}`}
                      </span>
                      <span style={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.9rem' }}>{user.address}</span>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ color: '#00ff88', fontWeight: 'bold', fontSize: '0.9rem' }}>${user.earnings}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{user.referrals} referrals</div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🏆</div>
                  <h4 style={{ color: '#ffd700', marginBottom: '1rem', fontSize: '1.1rem' }}>No Competitors Yet</h4>
                  <p style={{ opacity: 0.8, fontSize: '0.9rem', margin: '0' }}>
                    Be the first to make a referral this week and claim the top spot!
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Welcome Modal for New Wallet Connections */}
      {showWelcomeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            padding: '2rem',
            borderRadius: '16px',
            maxWidth: '500px',
            margin: '2rem',
            border: '3px solid #ffd700',
            color: 'white',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h3 style={{ color: '#ffd700', marginBottom: '1rem', fontSize: '1.5rem' }}>
              {currentWeek?.isPreLaunch ? 'Get Ready for the Weekly Challenge!' : 'Welcome to the Weekly Challenge!'}
            </h3>
            
            <p style={{ marginBottom: '1.5rem', lineHeight: '1.6', fontSize: '1rem' }}>
              {currentWeek?.isPreLaunch ? (
                <>
                  Your wallet is now connected! The weekly referral challenge will begin soon. 
                  Get ready to compete for <strong style={{ color: '#ffd700' }}>$50 USDT</strong> in prizes!
                </>
              ) : (
                <>
                  Your wallet is now connected! You can participate in our weekly referral challenge 
                  and compete for <strong style={{ color: '#ffd700' }}>$50 USDT</strong> in prizes.
                </>
              )}
            </p>

            <div style={{
              background: 'rgba(255, 215, 0, 0.1)',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              border: '1px solid rgba(255, 215, 0, 0.3)'
            }}>
              <h4 style={{ color: '#ffd700', marginBottom: '0.5rem', fontSize: '1.1rem' }}>This Week's Prizes:</h4>
              <div style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
                🥇 1st Place: $25 USDT<br/>
                🥈 2nd Place: $15 USDT<br/>
                🥉 3rd Place: $10 USDT
              </div>
            </div>

            {/* Don't show again checkbox */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '1.5rem',
              padding: '0.75rem',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <input
                type="checkbox"
                id="dontShowAgain"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                style={{
                  marginRight: '0.75rem',
                  transform: 'scale(1.2)',
                  accentColor: '#ffd700',
                  cursor: 'pointer'
                }}
              />
              <label 
                htmlFor="dontShowAgain" 
                style={{ 
                  fontSize: '0.9rem', 
                  cursor: 'pointer',
                  userSelect: 'none',
                  opacity: 0.9
                }}
              >
                Don't show this welcome message again
              </label>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexDirection: isMobile ? 'column' : 'row' }}>
              <button 
                onClick={() => {
                  if (dontShowAgain) {
                    localStorage.setItem('weeklyChallenge_dontShowWelcome', 'true');
                  }
                  setShowWelcomeModal(false);
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
              >
                Close
              </button>
              <button 
                onClick={() => {
                  if (dontShowAgain) {
                    localStorage.setItem('weeklyChallenge_dontShowWelcome', 'true');
                  }
                  setShowWelcomeModal(false);
                  // Scroll to the weekly challenge section
                  const element = document.querySelector('.weekly-challenge');
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'linear-gradient(45deg, #ffd700, #ffed4e)',
                  color: '#1a1a2e',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'transform 0.2s'
                }}
                onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
              >
                🚀 Take Me There!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRules && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            padding: '2rem',
            borderRadius: '16px',
            maxWidth: '500px',
            margin: '2rem',
            border: '2px solid #ffd700',
            color: 'white'
          }}>
            <h3 style={{ color: '#ffd700', marginBottom: '1.5rem' }}>📖 Weekly Challenge Rules</h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ color: '#ffd700', marginBottom: '0.5rem' }}>💰 Prize Distribution:</h4>
              <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.6' }}>
                <li>🥇 1st Place: $25 USDT (50%)</li>
                <li>🥈 2nd Place: $15 USDT (30%)</li>
                <li>🥉 3rd Place: $10 USDT (20%)</li>
              </ul>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ color: '#ffd700', marginBottom: '0.5rem' }}>🎯 How to Win:</h4>
              <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.6' }}>
                <li>Get the most referrals this week to rank higher</li>
                <li>In case of tie: highest referral rewards wins</li>
                <li>Challenge resets every <strong>Thursday 7:00 AM AEST</strong></li>
                <li>Must have at least 1 referral to qualify</li>
              </ul>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ color: '#ffd700', marginBottom: '0.5rem' }}>⚖️ Fair Play:</h4>
              <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.6' }}>
                <li>No self-referrals or fake accounts</li>
                <li>Prizes distributed within 72 hours</li>
                <li>BlackVault reserves final judgment</li>
              </ul>
            </div>

            <button 
              onClick={() => setShowRules(false)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'linear-gradient(45deg, #ffd700, #ffed4e)',
                color: '#1a1a2e',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Got it! 🚀
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyChallenge;

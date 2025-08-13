// src/components/LiveLeaderboard.js
import React, { useState, useEffect } from 'react';

const LiveLeaderboard = ({ data, isLoading, userAddress, currentWeek }) => {
  const [animatedData, setAnimatedData] = useState([]);
  const [showFullBoard, setShowFullBoard] = useState(false);

  useEffect(() => {
    if (data.length > 0) {
      // Animate entries one by one
      const animateEntries = async () => {
        for (let i = 0; i < data.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 150));
          setAnimatedData(prev => [...prev, data[i]]);
        }
      };
      
      setAnimatedData([]);
      animateEntries();
    }
  }, [data]);

  const formatAddress = (address) => {
    if (!address) return 'Anonymous';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getRankStyle = (rank) => {
    switch (rank) {
      case 1:
        return 'rank-gold';
      case 2:
        return 'rank-silver';
      case 3:
        return 'rank-bronze';
      default:
        return 'rank-default';
    }
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  const getPrizeAmount = (rank) => {
    switch (rank) {
      case 1:
        return '$25';
      case 2:
        return '$15';
      case 3:
        return '$10';
      default:
        return null;
    }
  };

  const isCurrentUser = (address) => {
    return userAddress && address.toLowerCase() === userAddress.toLowerCase();
  };

  if (isLoading) {
    return (
      <div className="leaderboard-container">
        <div className="leaderboard-header">
          <h2>🏆 Weekly Leaderboard</h2>
          <div className="loading-spinner">Loading...</div>
        </div>
        <div className="leaderboard-skeleton">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton-entry">
              <div className="skeleton-rank"></div>
              <div className="skeleton-info"></div>
              <div className="skeleton-earnings"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const displayData = showFullBoard ? animatedData : animatedData.slice(0, 5);

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header">
        <h2>🏆 Weekly Leaderboard</h2>
        <div className="leaderboard-info">
          <span className="live-indicator">🔴 LIVE</span>
          <span className="update-text">Updates every 5 minutes</span>
        </div>
      </div>

      <div className="leaderboard-list">
        {displayData.map((entry, index) => (
          <div 
            key={entry.address}
            className={`leaderboard-entry ${getRankStyle(entry.rank)} ${
              isCurrentUser(entry.address) ? 'current-user' : ''
            }`}
            style={{ 
              animationDelay: `${index * 150}ms`,
              transform: `translateY(${index * 2}px)`
            }}
          >
            <div className="rank-section">
              <div className="rank-icon">
                {getRankIcon(entry.rank)}
              </div>
              {entry.rank <= 3 && (
                <div className="prize-badge">
                  {getPrizeAmount(entry.rank)}
                </div>
              )}
            </div>

            <div className="user-info">
              <div className="user-address">
                {formatAddress(entry.address)}
                {isCurrentUser(entry.address) && (
                  <span className="you-badge">YOU</span>
                )}
              </div>
              <div className="user-stats">
                <span className="referral-count">
                  👥 {entry.referrals} referrals
                </span>
              </div>
            </div>

            <div className="earnings-section">
              <div className="earnings-amount">
                ${entry.earnings.toFixed(2)}
              </div>
              <div className="earnings-label">USDT</div>
              
              {entry.rank <= 3 && (
                <div className="winning-indicator">
                  <span className="trophy-icon">🏆</span>
                  <span className="winning-text">WINNING!</span>
                </div>
              )}
            </div>

            {isCurrentUser(entry.address) && (
              <div className="user-highlight">
                <div className="highlight-beam"></div>
              </div>
            )}
          </div>
        ))}

        {animatedData.length === 0 && !isLoading && (
          <div className="empty-leaderboard">
            <div className="empty-icon">🎯</div>
            <h3>Be the First!</h3>
            <p>Start referring users to appear on the leaderboard</p>
          </div>
        )}
      </div>

      {animatedData.length > 5 && (
        <div className="leaderboard-actions">
          <button 
            className="toggle-view-btn"
            onClick={() => setShowFullBoard(!showFullBoard)}
          >
            {showFullBoard ? '👆 Show Top 5' : '👇 View Full Board'}
          </button>
        </div>
      )}

      <div className="leaderboard-footer">
        <div className="challenge-note">
          <span className="note-icon">💡</span>
          <span>Rankings update based on referral rewards earned this week</span>
        </div>
      </div>
    </div>
  );
};

export default LiveLeaderboard;

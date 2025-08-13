// src/components/UserProgress.js
import React, { useState, useEffect } from 'react';

const UserProgress = ({ stats, currentWeek, isConnected, isLoading }) => {
  const [progressAnimation, setProgressAnimation] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  // Animate progress bars
  useEffect(() => {
    if (stats.weeklyEarnings > 0) {
      const timer = setTimeout(() => {
        setProgressAnimation(Math.min((stats.weeklyEarnings / 50) * 100, 100));
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [stats.weeklyEarnings]);

  if (!isConnected) {
    return (
      <div className="user-progress-container">
        <div className="progress-header">
          <h3>Your Progress</h3>
        </div>
        <div className="connect-prompt">
          <div className="connect-icon">👛</div>
          <h4>Connect Your Wallet</h4>
          <p>Connect your wallet to see your weekly challenge progress and compete for prizes!</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="user-progress-container">
        <div className="progress-header">
          <h3>Your Progress</h3>
        </div>
        <div className="progress-loading">
          <div className="loading-spinner"></div>
          <span>Loading your stats...</span>
        </div>
      </div>
    );
  }

  const getPositionMessage = () => {
    if (stats.position <= 3) {
      return {
        message: `You're in the prize zone!`,
        emoji: '🏆',
        class: 'winning'
      };
    } else if (stats.position <= 5) {
      return {
        message: `So close to prizes!`,
        emoji: '🔥',
        class: 'close'
      };
    } else {
      return {
        message: `Keep climbing!`,
        emoji: '💪',
        class: 'climbing'
      };
    }
  };

  const positionMessage = getPositionMessage();

  const getNextMilestone = () => {
    const earnings = stats.weeklyEarnings;
    if (earnings < 10) return { target: 10, label: 'Top 10' };
    if (earnings < 25) return { target: 25, label: 'Top 5' };
    if (earnings < 35) return { target: 35, label: '3rd Place' };
    if (earnings < 40) return { target: 40, label: '2nd Place' };
    if (earnings < 45) return { target: 45, label: '1st Place' };
    return { target: 50, label: 'Leader' };
  };

  const nextMilestone = getNextMilestone();
  const milestoneProgress = (stats.weeklyEarnings / nextMilestone.target) * 100;

  return (
    <div className="user-progress-container">
      <div className="progress-header">
        <h3>Your Progress</h3>
        <div className={`position-status ${positionMessage.class}`}>
          <span className="status-emoji">{positionMessage.emoji}</span>
          <span className="status-text">{positionMessage.message}</span>
        </div>
      </div>

      <div className="progress-stats">
        <div className="stat-card primary">
          <div className="stat-icon">📍</div>
          <div className="stat-content">
            <div className="stat-value">#{stats.position}</div>
            <div className="stat-label">Current Rank</div>
          </div>
          {stats.position <= 3 && (
            <div className="prize-indicator">
              🏆 ${stats.position === 1 ? '25' : stats.position === 2 ? '15' : '10'}
            </div>
          )}
        </div>

        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-value">${stats.weeklyEarnings.toFixed(2)}</div>
            <div className="stat-label">Weekly Earnings</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalReferrals}</div>
            <div className="stat-label">Referrals</div>
          </div>
        </div>
      </div>

      {/* Progress to next milestone */}
      <div className="milestone-progress">
        <div className="milestone-header">
          <span className="milestone-label">Next: {nextMilestone.label}</span>
          <span className="milestone-target">${nextMilestone.target}</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ 
              width: `${Math.min(milestoneProgress, 100)}%`,
              transition: 'width 1s ease-out'
            }}
          />
        </div>
        <div className="progress-text">
          ${(nextMilestone.target - stats.weeklyEarnings).toFixed(2)} to go
        </div>
      </div>

      {/* Weekly breakdown toggle */}
      <div className="progress-details">
        <button 
          className="details-toggle"
          onClick={() => setShowDetails(!showDetails)}
        >
          <span>Weekly Breakdown</span>
          <span className={`toggle-icon ${showDetails ? 'open' : ''}`}>▼</span>
        </button>

        {showDetails && (
          <div className="details-content">
            <div className="detail-item">
              <span className="detail-label">Average per referral:</span>
              <span className="detail-value">
                ${stats.totalReferrals > 0 ? (stats.weeklyEarnings / stats.totalReferrals).toFixed(2) : '0.00'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Days remaining:</span>
              <span className="detail-value">
                {Math.ceil((currentWeek.end - new Date()) / (1000 * 60 * 60 * 24))} days
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Challenge week:</span>
              <span className="detail-value">
                {currentWeek.start.toLocaleDateString()} - {currentWeek.end.toLocaleDateString()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="progress-actions">
        <button 
          className="action-btn primary"
          onClick={() => {
            // Open referral modal or scroll to referral section
            const referralSection = document.querySelector('.referrals-section');
            if (referralSection) {
              referralSection.scrollIntoView({ behavior: 'smooth' });
            }
          }}
        >
          <span className="btn-icon">🚀</span>
          Invite More
        </button>
        
        <button 
          className="action-btn secondary"
          onClick={() => {
            // Copy referral link
            const referralLink = `${window.location.origin}?ref=${stats.walletAddress}`;
            navigator.clipboard.writeText(referralLink);
            // Show toast notification
          }}
        >
          <span className="btn-icon">📋</span>
          Copy Link
        </button>
      </div>

      {/* Motivational messages */}
      <div className="motivation-section">
        {stats.position > 3 && (
          <div className="motivation-card">
            <div className="motivation-icon">🎯</div>
            <div className="motivation-text">
              {stats.position <= 5 
                ? "You're so close to winning! Just a few more referrals could put you in the prize zone!"
                : "Every referral counts! Start climbing the leaderboard and aim for those weekly prizes!"
              }
            </div>
          </div>
        )}
        
        {stats.position <= 3 && (
          <div className="motivation-card winning">
            <div className="motivation-icon">🏆</div>
            <div className="motivation-text">
              Amazing! You're currently winning ${stats.position === 1 ? '25' : stats.position === 2 ? '15' : '10'} USDT! 
              Keep up the great work to secure your prize!
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProgress;

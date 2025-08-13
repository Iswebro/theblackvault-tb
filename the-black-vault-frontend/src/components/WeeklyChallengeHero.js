// src/components/WeeklyChallengeHero.js
import React, { useState, useEffect } from 'react';

const WeeklyChallengeHero = ({ currentWeek, userStats, isConnected, onShowRules }) => {
  const [timeRemaining, setTimeRemaining] = useState('');
  const [animate, setAnimate] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (!currentWeek) return;

    const updateCountdown = () => {
      const now = new Date();
      const timeLeft = currentWeek.end.getTime() - now.getTime();
      
      if (timeLeft <= 0) {
        setTimeRemaining('Challenge Ended');
        return;
      }

      const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

      setTimeRemaining(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [currentWeek]);

  // Animation trigger
  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const getPrizeForPosition = (position) => {
    switch (position) {
      case 1: return '$25 USDT';
      case 2: return '$15 USDT';
      case 3: return '$10 USDT';
      default: return null;
    }
  };

  const getPositionEmoji = (position) => {
    switch (position) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return '🔥';
    }
  };

  return (
    <div className={`challenge-hero ${animate ? 'animate' : ''}`}>
      <div className="hero-background">
        <div className="floating-diamonds">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`diamond diamond-${i + 1}`}>💎</div>
          ))}
        </div>
      </div>
      
      <div className="hero-content">
        <div className="hero-header">
          <h1 className="hero-title">
            <span className="diamond-icon">💎</span>
            Weekly Referral Challenge
            <span className="diamond-icon">💎</span>
          </h1>
          <div className="prize-pool">
            <span className="pool-label">Prize Pool</span>
            <span className="pool-amount">$50 USDT</span>
          </div>
        </div>

        <div className="hero-stats">
          <div className="countdown-section">
            <div className="countdown-label">⏰ Time Remaining</div>
            <div className="countdown-timer">{timeRemaining}</div>
          </div>

          {isConnected && userStats.isParticipating && (
            <div className="user-position">
              <div className="position-card">
                <div className="position-rank">
                  <span className="rank-emoji">{getPositionEmoji(userStats.position)}</span>
                  <span className="rank-text">
                    {userStats.position <= 3 ? `${userStats.position}st Place` : `#${userStats.position}`}
                  </span>
                </div>
                <div className="position-earnings">
                  <span className="earnings-amount">${userStats.weeklyEarnings.toFixed(2)} USDT</span>
                  <span className="earnings-label">This Week</span>
                </div>
                {userStats.position <= 3 && (
                  <div className="prize-indicator">
                    🏆 {getPrizeForPosition(userStats.position)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="hero-actions">
          <button 
            className="primary-btn challenge-btn"
            onClick={() => {
              // Scroll to referral section or open referral modal
              const referralSection = document.querySelector('.referrals-section');
              if (referralSection) {
                referralSection.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          >
            <span className="btn-icon">🚀</span>
            Start Referring
          </button>
          
          <button 
            className="secondary-btn rules-btn"
            onClick={onShowRules}
          >
            <span className="btn-icon">📋</span>
            Challenge Rules
          </button>
        </div>

        <div className="prize-breakdown">
          <div className="prize-item gold">
            <span className="prize-rank">🥇 1st</span>
            <span className="prize-amount">$25</span>
          </div>
          <div className="prize-item silver">
            <span className="prize-rank">🥈 2nd</span>
            <span className="prize-amount">$15</span>
          </div>
          <div className="prize-item bronze">
            <span className="prize-rank">🥉 3rd</span>
            <span className="prize-amount">$10</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyChallengeHero;

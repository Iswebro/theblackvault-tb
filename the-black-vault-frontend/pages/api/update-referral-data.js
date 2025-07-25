// pages/api/update-referral-data.js
// API endpoint to update referral data in Upstash when deposits are made
// This should be called after successful deposits to maintain accurate referral records

import { Redis } from '@upstash/redis';
import { ethers } from 'ethers';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  const { method, body } = req;
  
  if (method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { referrer, referee, depositAmount, transactionHash, blockNumber, timestamp } = body;
  
  if (!referrer || !referee || !depositAmount || !ethers.isAddress(referrer) || !ethers.isAddress(referee)) {
    return res.status(400).json({ error: 'Valid referrer, referee addresses and deposit amount required' });
  }

  try {
    // Generate referral record
    const referralRecord = {
      referee: referee.toLowerCase(),
      referrer: referrer.toLowerCase(), 
      depositAmount,
      transactionHash,
      blockNumber,
      timestamp: timestamp || new Date().toISOString(),
      addedAt: new Date().toISOString()
    };

    // Store in multiple keys for efficient querying
    const referrerKey = `referrals:${referrer.toLowerCase()}`;
    const refereeKey = `referee:${referee.toLowerCase()}`;
    const txKey = `referral-tx:${transactionHash}`;

    // Get existing referrals for this referrer
    let existingReferrals = [];
    try {
      existingReferrals = await redis.get(referrerKey) || [];
    } catch (e) {
      console.warn("Could not get existing referrals:", e.message);
    }

    // Check if this referral already exists (prevent duplicates)
    const isDuplicate = existingReferrals.some(ref => 
      ref.referee.toLowerCase() === referee.toLowerCase() && 
      ref.transactionHash === transactionHash
    );

    if (isDuplicate) {
      console.log("Referral already exists, skipping duplicate");
      return res.status(200).json({ 
        success: true, 
        message: 'Referral already recorded',
        duplicate: true
      });
    }

    // Add new referral
    existingReferrals.push(referralRecord);

    // Store updated referrals list
    await Promise.all([
      redis.set(referrerKey, existingReferrals), // Store all referrals for this referrer
      redis.set(refereeKey, referralRecord), // Store referee -> referrer mapping
      redis.set(txKey, referralRecord) // Store transaction -> referral mapping
    ]);

    // Also clear any cached user-referrals data to force refresh
    const cacheKeyLower = `user-referrals:${referrer.toLowerCase()}`;
    const cacheKeyOriginal = `user-referrals:${referrer}`;
    await Promise.all([
      redis.del(cacheKeyLower).catch(() => {}),
      redis.del(cacheKeyOriginal).catch(() => {})
    ]);

    console.log(`✅ REFERRAL: Updated referral data for ${referrer} (referee: ${referee})`);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Referral data updated successfully',
      totalReferrals: existingReferrals.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ REFERRAL: Error updating referral data:", error);
    return res.status(500).json({ 
      error: 'Failed to update referral data', 
      details: error.message 
    });
  }
}

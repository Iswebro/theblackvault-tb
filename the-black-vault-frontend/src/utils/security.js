// src/utils/security.js
// Security utilities for frontend validation and error handling

import { ethers } from 'ethers';

/**
 * Validates Ethereum addresses and prevents zero address usage
 */
export const validateAddress = (address) => {
  if (!address || address === ethers.ZeroAddress || address === "0x0000000000000000000000000000000000000000") {
    return { valid: false, error: "Invalid or zero address" };
  }
  try {
    const isValidAddress = ethers.isAddress(address);
    return { 
      valid: isValidAddress, 
      error: isValidAddress ? null : "Invalid address format" 
    };
  } catch {
    return { valid: false, error: "Address validation failed" };
  }
};

/**
 * Validates amounts with min/max constraints
 */
export const validateAmount = (amount, maxAmount = null, minAmount = 0) => {
  const numAmount = Number.parseFloat(amount);
  
  if (!amount || amount === '') {
    return { valid: false, error: "Amount is required" };
  }
  
  if (isNaN(numAmount)) {
    return { valid: false, error: "Invalid amount format" };
  }
  
  if (numAmount < minAmount) {
    return { valid: false, error: `Amount must be ${minAmount} or greater` };
  }
  
  if (maxAmount !== null && numAmount > Number.parseFloat(maxAmount)) {
    return { valid: false, error: `Cannot exceed maximum amount of ${maxAmount}` };
  }
  
  return { valid: true };
};

/**
 * Safe contract call wrapper with proper error handling
 */
export const safeContractCall = async (contractCall, errorMessage = "Transaction failed") => {
  try {
    const tx = await contractCall();
    const receipt = await tx.wait();
    
    if (receipt.status !== 1) {
      throw new Error("Transaction failed - receipt status is not 1");
    }
    
    return { success: true, receipt };
  } catch (error) {
    console.error("Contract call failed:", error);
    
    // Handle specific error types for better UX
    if (error.code === 4001) {
      throw new Error("Transaction cancelled by user");
    } else if (error.code === "INSUFFICIENT_FUNDS") {
      throw new Error("Insufficient funds for transaction");
    } else if (error.code === "UNPREDICTABLE_GAS_LIMIT") {
      throw new Error("Transaction would fail - please check requirements");
    } else if (error.code === "CALL_EXCEPTION") {
      throw new Error("Contract call reverted - check requirements");
    } else if (error.reason) {
      throw new Error(error.reason);
    } else if (error.message) {
      throw new Error(error.message);
    } else {
      throw new Error(errorMessage);
    }
  }
};

/**
 * Sanitizes and validates input values
 */
export const sanitizeInput = (value, type = 'text') => {
  if (type === 'number') {
    // Remove any non-numeric characters except decimal point
    const cleaned = value.replace(/[^0-9.]/g, '');
    // Ensure only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    return cleaned;
  }
  
  if (type === 'address') {
    // Remove any characters that aren't valid hex
    return value.replace(/[^0-9a-fA-Fx]/g, '');
  }
  
  return value;
};

/**
 * Prevents common DoS attacks by limiting input size
 */
export const validateInputLength = (input, maxLength = 100) => {
  if (typeof input !== 'string') {
    return { valid: false, error: "Invalid input type" };
  }
  
  if (input.length > maxLength) {
    return { valid: false, error: `Input too long (max ${maxLength} characters)` };
  }
  
  return { valid: true };
};

/**
 * Rate limiting for API calls
 */
export class RateLimiter {
  constructor(maxCalls = 10, windowMs = 60000) { // 10 calls per minute default
    this.maxCalls = maxCalls;
    this.windowMs = windowMs;
    this.calls = [];
  }
  
  canMakeCall() {
    const now = Date.now();
    
    // Remove calls outside the window
    this.calls = this.calls.filter(callTime => now - callTime < this.windowMs);
    
    // Check if we can make another call
    if (this.calls.length >= this.maxCalls) {
      return { allowed: false, error: "Rate limit exceeded. Please wait." };
    }
    
    // Record this call
    this.calls.push(now);
    return { allowed: true };
  }
}

/**
 * Secure transaction builder with validation
 */
export const buildSecureTransaction = (contract, functionName, params = [], options = {}) => {
  // Validate contract
  if (!contract || typeof contract[functionName] !== 'function') {
    throw new Error(`Invalid contract or function: ${functionName}`);
  }
  
  // Validate parameters
  if (!Array.isArray(params)) {
    throw new Error("Parameters must be an array");
  }
  
  // Validate addresses in parameters
  params.forEach((param, index) => {
    if (typeof param === 'string' && param.startsWith('0x') && param.length === 42) {
      const validation = validateAddress(param);
      if (!validation.valid) {
        throw new Error(`Invalid address at parameter ${index}: ${validation.error}`);
      }
    }
  });
  
  return {
    contract,
    functionName,
    params,
    options,
    execute: () => contract[functionName](...params, options)
  };
};

// Export a default object with all utilities
export default {
  validateAddress,
  validateAmount,
  safeContractCall,
  sanitizeInput,
  validateInputLength,
  RateLimiter,
  buildSecureTransaction
};

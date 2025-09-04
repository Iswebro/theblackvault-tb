import { ethers } from "ethers"

const BlackVaultABI = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "referrer",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "cycle",
        type: "uint256",
      },
    ],
    name: "Deposited",
    type: "event",
  }
]

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('🧪 Testing ultra-small chunk sizes...')
    
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://bsc-dataseed.binance.org/"
    
    console.log('🔗 Using RPC:', rpcUrl.substring(0, 30) + '...')
    console.log('📧 Contract:', contractAddress)
    
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const contract = new ethers.Contract(contractAddress, BlackVaultABI, provider)
    
    // Get current block
    const latestBlock = await provider.getBlockNumber()
    console.log('📦 Latest block:', latestBlock)
    
    const depositedFilter = contract.filters.Deposited()
    
    // Test progressively smaller chunk sizes
    const chunkSizes = [50, 25, 10, 5, 1]
    const results = []
    
    for (const chunkSize of chunkSizes) {
      console.log(`\n🧪 Testing chunk size: ${chunkSize} blocks`)
      const fromBlock = latestBlock - chunkSize
      const toBlock = latestBlock
      
      try {
        console.log(`📦 Query range: ${fromBlock} to ${toBlock}`)
        const startTime = Date.now()
        
        const events = await contract.queryFilter(depositedFilter, fromBlock, toBlock)
        
        const duration = Date.now() - startTime
        console.log(`✅ SUCCESS: ${events.length} events in ${duration}ms`)
        
        results.push({
          chunkSize,
          success: true,
          eventCount: events.length,
          duration,
          range: `${fromBlock}-${toBlock}`
        })
        
      } catch (error) {
        console.log(`❌ FAILED: ${error.message}`)
        results.push({
          chunkSize,
          success: false,
          error: error.message,
          range: `${fromBlock}-${toBlock}`
        })
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    console.log('\n📊 Test Results Summary:')
    results.forEach(result => {
      if (result.success) {
        console.log(`✅ ${result.chunkSize} blocks: ${result.eventCount} events (${result.duration}ms)`)
      } else {
        console.log(`❌ ${result.chunkSize} blocks: FAILED - ${result.error}`)
      }
    })
    
    // Find the largest working chunk size
    const workingChunks = results.filter(r => r.success)
    const maxWorkingChunk = workingChunks.length > 0 ? Math.max(...workingChunks.map(r => r.chunkSize)) : null
    
    console.log(`\n🎯 Recommended chunk size: ${maxWorkingChunk || 'All failed - RPC severely limited'}`)
    
    res.status(200).json({
      success: true,
      latestBlock,
      testResults: results,
      recommendedChunkSize: maxWorkingChunk,
      summary: `Tested chunk sizes from 50 down to 1 block. Max working: ${maxWorkingChunk || 'none'}`
    })
    
  } catch (error) {
    console.error('🚨 Test failed:', error)
    res.status(500).json({ 
      error: 'Test failed', 
      details: error.message 
    })
  }
}

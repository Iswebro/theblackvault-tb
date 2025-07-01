import fs from "fs"
import path from "path"

// This script sets up the leaderboard system for your launch date
function setupLeaderboard() {
  const launchTimestamp = Math.floor(Date.now() / 1000) // Current time as launch time
  const launchDate = new Date(launchTimestamp * 1000)

  console.log("🚀 Setting up leaderboard system...")
  console.log("📅 Launch Date:", launchDate.toISOString())
  console.log("⏰ Launch Timestamp:", launchTimestamp)

  // Create leaderboard data directory
  const dataDir = path.resolve("./leaderboard-data")
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
    console.log("📁 Created leaderboard data directory")
  }

  // Create initial empty leaderboard files
  const weeklyData = {
    weekIndex: 0,
    weekStart: launchTimestamp,
    weekEnd: launchTimestamp + 7 * 24 * 60 * 60,
    generatedAt: launchTimestamp,
    leaderboard: [],
  }

  const lifetimeData = {
    generatedAt: launchTimestamp,
    leaderboard: [],
  }

  fs.writeFileSync(path.join(dataDir, "week-0.json"), JSON.stringify(weeklyData, null, 2))
  fs.writeFileSync(path.join(dataDir, "lifetime.json"), JSON.stringify(lifetimeData, null, 2))

  console.log("✅ Leaderboard system setup complete!")
  console.log("📊 Week 1 starts now and will reset every Monday at 7 AM AEST")
  console.log("🎯 Users can now start making referrals and earning rewards!")

  return {
    launchTimestamp,
    launchDate: launchDate.toISOString(),
    weeklyFile: path.join(dataDir, "week-0.json"),
    lifetimeFile: path.join(dataDir, "lifetime.json"),
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupLeaderboard()
}

export { setupLeaderboard }

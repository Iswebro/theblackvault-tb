// Central launch configuration
// Update this timestamp to your actual launch date/time

export const LAUNCH_CONFIG = {
  // Set this to your actual launch timestamp when you go live
  // Current value is January 1, 2025 00:00:00 UTC
  // You can use https://www.epochconverter.com/ to convert your launch date
  LAUNCH_TIMESTAMP: 1735689600,

  // Helper function to get current week index
  getCurrentWeekIndex() {
    const nowTs = Math.floor(Date.now() / 1000)
    const WEEK_DURATION = 7 * 24 * 60 * 60 // 7 days in seconds

    // If current time is before launch, return 0
    if (nowTs < this.LAUNCH_TIMESTAMP) {
      return 0
    }

    return Math.floor((nowTs - this.LAUNCH_TIMESTAMP) / WEEK_DURATION)
  },

  // Helper function to check if platform has launched
  hasLaunched() {
    return Math.floor(Date.now() / 1000) >= this.LAUNCH_TIMESTAMP
  },

  // Helper function to get launch date as readable string
  getLaunchDate() {
    return new Date(this.LAUNCH_TIMESTAMP * 1000).toISOString()
  },

  // Helper function to set launch date to current time (for immediate launch)
  setLaunchToNow() {
    this.LAUNCH_TIMESTAMP = Math.floor(Date.now() / 1000)
    console.log("🚀 Launch timestamp set to:", this.getLaunchDate())
    return this.LAUNCH_TIMESTAMP
  },
}

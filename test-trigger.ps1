# PowerShell script to test the referral system
Write-Host "🔄 Testing the referral system fix..." -ForegroundColor Cyan

try {
    # 1. Check current referrer data
    Write-Host "`n1. Checking current referrer data..." -ForegroundColor Yellow
    $checkResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/check-referrer?address=0xB98e82C611BFc1b852412268fd300E28fAEE4D48" -Method GET
    Write-Host "Current referrer data:" -ForegroundColor Green
    $checkResponse | ConvertTo-Json -Depth 5

    # 2. Trigger weekly update
    Write-Host "`n2. Triggering weekly update..." -ForegroundColor Yellow
    $triggerResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/trigger-weekly-update" -Method POST -ContentType "application/json"
    Write-Host "Trigger result:" -ForegroundColor Green
    $triggerResponse | ConvertTo-Json -Depth 3

    # 3. Check weekly leaderboard
    Write-Host "`n3. Checking weekly leaderboard..." -ForegroundColor Yellow
    $leaderboardResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/leaderboard/weekly" -Method GET
    Write-Host "Weekly leaderboard entries: $($leaderboardResponse.data.leaderboard.Count)" -ForegroundColor Green
    
    # Check if target referrer is found
    $targetReferrer = "0xB98e82C611BFc1b852412268fd300E28fAEE4D48"
    $foundReferrer = $leaderboardResponse.data.leaderboard | Where-Object { $_.referrer.ToLower() -eq $targetReferrer.ToLower() }
    
    if ($foundReferrer) {
        Write-Host "✅ SUCCESS: Target referrer found in leaderboard!" -ForegroundColor Green
        Write-Host "Referrer data:" -ForegroundColor Green
        $foundReferrer | ConvertTo-Json -Depth 3
    } else {
        Write-Host "❌ Target referrer still not in leaderboard" -ForegroundColor Red
        Write-Host "Top 5 leaderboard entries:" -ForegroundColor Yellow
        $leaderboardResponse.data.leaderboard | Select-Object -First 5 | ForEach-Object {
            Write-Host "$($_.referrer) - $($_.totalReferrals) referrals"
        }
    }

} catch {
    Write-Host "❌ Test failed: $($_.Exception.Message)" -ForegroundColor Red
}

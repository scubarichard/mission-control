# Gate 4 — Expense creation E2E test
# Run this after Richard adds Category + Paid By options in Airtable UI
# Results written to RESULTS/gate4_results.md

$raw = Get-Content "P:\_clients\pnt-central-brain\.env" -Raw -Encoding UTF8
$token = ($raw -split "`n" | Where-Object { $_ -match "AIRTABLE" } | Select-Object -First 1) -replace ".*=", "" -replace "\s", ""
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
$base = "https://api.airtable.com/v0/appDqWxcM86CpBHoQ"

$results = @()
$pass = $true

try {
    $bookingId = (Invoke-RestMethod -Uri "$base/Bookings?maxRecords=1" -Headers $headers).records[0].id
    $guideId = (Invoke-RestMethod -Uri "$base/Guides_Staff?maxRecords=1" -Headers $headers).records[0].id

    # Create payroll
    $p = @{ fields = @{ Booking = @($bookingId); Guide = @($guideId); "Days Worked" = 5; "Daily Rate" = 180; Status = "Pending" } } | ConvertTo-Json -Depth 5
    $payroll = Invoke-RestMethod -Method Post -Uri "$base/Guide_Payroll" -Headers $headers -Body $p -ContentType "application/json"
    $results += "Payroll created: $($payroll.id) — PASS"

    Start-Sleep -Milliseconds 300

    # Expense A
    $a = @{ fields = @{ Booking = @($bookingId); "Guide Payroll" = @($payroll.id); Category = "Guide"; Amount = 45; "Paid By" = "Guide"; Status = "Pending" } } | ConvertTo-Json -Depth 5
    $expA = Invoke-RestMethod -Method Post -Uri "$base/Expenses" -Headers $headers -Body $a -ContentType "application/json"
    $results += "Expense A created: $($expA.id) — PASS"

    # Expense B
    $b = @{ fields = @{ Booking = @($bookingId); Category = "Taxi"; Amount = 120; "Paid By" = "PNT"; Status = "Pending" } } | ConvertTo-Json -Depth 5
    $expB = Invoke-RestMethod -Method Post -Uri "$base/Expenses" -Headers $headers -Body $b -ContentType "application/json"
    $results += "Expense B created: $($expB.id) — PASS"

    Start-Sleep -Milliseconds 300

    # Verify
    $vP = Invoke-RestMethod -Uri "$base/Guide_Payroll/$($payroll.id)" -Headers $headers
    $vA = Invoke-RestMethod -Uri "$base/Expenses/$($expA.id)" -Headers $headers
    $vB = Invoke-RestMethod -Uri "$base/Expenses/$($expB.id)" -Headers $headers

    $results += "Payroll Booking link: $(if ($vP.fields.Booking) {'PASS'} else {'FAIL'})"
    $results += "Payroll Guide link: $(if ($vP.fields.Guide) {'PASS'} else {'FAIL'})"
    $results += "Expense A Category=Guide: $(if ($vA.fields.Category -eq 'Guide') {'PASS'} else {'FAIL got=' + $vA.fields.Category})"
    $results += "Expense A Paid By=Guide: $(if ($vA.fields.'Paid By' -eq 'Guide') {'PASS'} else {'FAIL got=' + $vA.fields.'Paid By'})"
    $results += "Expense A Payroll link: $(if ($vA.fields.'Guide Payroll') {'PASS'} else {'FAIL'})"
    $results += "Expense B Category=Taxi: $(if ($vB.fields.Category -eq 'Taxi') {'PASS'} else {'FAIL got=' + $vB.fields.Category})"
    $results += "Expense B Paid By=PNT: $(if ($vB.fields.'Paid By' -eq 'PNT') {'PASS'} else {'FAIL got=' + $vB.fields.'Paid By'})"

    # Cleanup
    Invoke-RestMethod -Method Delete -Uri "$base/Expenses?records[]=$($expA.id)&records[]=$($expB.id)" -Headers $headers | Out-Null
    Invoke-RestMethod -Method Delete -Uri "$base/Guide_Payroll?records[]=$($payroll.id)" -Headers $headers | Out-Null
    $results += "Cleanup: PASS"

} catch {
    $results += "ERROR: $($_.Exception.Message)"
    $pass = $false
}

# Write results
$output = "# Gate 4 Results`n"
$output += "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n"
$output += "Overall: $(if ($pass) {'PASS'} else {'FAIL'})`n`n"
$output += ($results | ForEach-Object { "- $_" }) -join "`n"

New-Item -ItemType Directory -Force -Path "RESULTS" | Out-Null
$output | Out-File "RESULTS/gate4_results.md" -Encoding UTF8
Write-Host $output

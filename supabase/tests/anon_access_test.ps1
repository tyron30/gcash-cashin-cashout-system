# Checks that a LOGGED-OUT visitor (using only the public/publishable key
# from your .env) cannot read or write anything. Run from PowerShell:
#   cd C:\Projects\gcash-monitor
#   powershell -ExecutionPolicy Bypass -File .\supabase\tests\anon_access_test.ps1

$envPath = Join-Path $PSScriptRoot '..\..\.env'
if (-not (Test-Path $envPath)) { Write-Host "No .env file found at $envPath" -ForegroundColor Red; exit 1 }

$cfg = @{}
Get-Content $envPath | ForEach-Object {
  if ($_ -match '^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$') { $cfg[$matches[1]] = $matches[2].Trim('"') }
}
$url = $cfg['VITE_SUPABASE_URL']
$key = $cfg['VITE_SUPABASE_PUBLISHABLE_KEY']
if (-not $url -or -not $key) { Write-Host "Fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env first." -ForegroundColor Red; exit 1 }

$headers = @{ apikey = $key; 'Content-Type' = 'application/json' }
if ($key -notlike 'sb_publishable_*') { $headers['Authorization'] = "Bearer $key" }

$failed = 0
function Check($name, $block) {
  try {
    $result = & $block
    # A call that succeeds is only OK if it returned NO rows.
    if ($null -eq $result -or @($result).Count -eq 0) {
      Write-Host "PASS  $name (empty result)" -ForegroundColor Green
    } else {
      Write-Host "FAIL  $name -> data was returned!" -ForegroundColor Red; $script:failed++
    }
  } catch {
    Write-Host "PASS  $name (blocked: $($_.Exception.Message.Split("`n")[0]))" -ForegroundColor Green
  }
}

foreach ($table in 'transactions','profiles','daily_closings','audit_logs','store_settings') {
  Check "Anonymous read of $table" { Invoke-RestMethod -Uri "$url/rest/v1/${table}?select=*&limit=1" -Headers $headers }
}

$body = '{"p_transaction_type":"cash_in","p_reference_number":"5555666677778","p_amount":100}'
Check "Anonymous create_transaction" { Invoke-RestMethod -Method Post -Uri "$url/rest/v1/rpc/create_transaction" -Headers $headers -Body $body }
Check "Anonymous insert into transactions" { Invoke-RestMethod -Method Post -Uri "$url/rest/v1/transactions" -Headers $headers -Body '{"reference_number":"1","transaction_type":"cash_in","amount":1}' }

if ($failed -gt 0) { Write-Host "`n$failed check(s) FAILED. Do not use this project until fixed." -ForegroundColor Red; exit 1 }
Write-Host "`nAll anonymous-access checks passed." -ForegroundColor Green

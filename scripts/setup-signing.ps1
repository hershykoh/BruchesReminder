###############################################################################
# setup-signing.ps1
#
# ONE-TIME SETUP — run from repo root:
#   .\scripts\setup-signing.ps1
#
# What it does:
#   1. Generates a 10-year self-signed RSA-4096 code-signing certificate
#   2. Exports it as a PFX file (password-protected)
#   3. Base64-encodes the PFX and stores it in two GitHub repo Secrets:
#        WIN_CSC_LINK          — base64 PFX (used by electron-builder to sign)
#        WIN_CSC_KEY_PASSWORD  — PFX password
#   4. Cleans up the temp PFX file
#
# Requirements: gh CLI authenticated (gh auth status)
#   Install: winget install --id GitHub.cli
###############################################################################
$ErrorActionPreference = "Stop"

$repo = "hershykoh/BruchesReminder"

Write-Host ""
Write-Host "=== Bracha Reminder — Free Code-Signing Setup ===" -ForegroundColor Cyan
Write-Host ""

# ── 1. Check gh is available ─────────────────────────────────────────────────
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "gh CLI not found. Install with: winget install --id GitHub.cli"
}
gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Error "Not logged in to gh. Run: gh auth login" }

# ── 2. Choose a PFX password ──────────────────────────────────────────────────
$securePassword = Read-Host "Choose a password for the certificate PFX" -AsSecureString
$secureConfirm  = Read-Host "Confirm password" -AsSecureString

$p1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))
$p2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureConfirm))

if ($p1 -ne $p2) { Write-Error "Passwords do not match. Exiting." }

# ── 3. Generate self-signed code-signing certificate ─────────────────────────
Write-Host "`nGenerating RSA-4096 code-signing certificate (10-year validity)..." -ForegroundColor Yellow

$cert = New-SelfSignedCertificate `
    -Type         CodeSigningCert `
    -Subject      "CN=Bracha Reminder, O=BrachaReminder, C=IL" `
    -KeyAlgorithm RSA `
    -KeyLength    4096 `
    -HashAlgorithm SHA256 `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter     (Get-Date).AddYears(10)

Write-Host "  Thumbprint: $($cert.Thumbprint)" -ForegroundColor Gray

# ── 4. Export to PFX ──────────────────────────────────────────────────────────
$pfxPath = Join-Path $env:TEMP "brachareminder-sign.pfx"
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePassword | Out-Null
Write-Host "  Exported PFX to: $pfxPath" -ForegroundColor Gray

# ── 5. Base64-encode ──────────────────────────────────────────────────────────
$base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($pfxPath))

# ── 6. Push secrets to GitHub ─────────────────────────────────────────────────
Write-Host "`nUploading secrets to $repo ..." -ForegroundColor Yellow

$base64 | gh secret set WIN_CSC_LINK          --repo $repo
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to set WIN_CSC_LINK secret" }
Write-Host "  ✓ WIN_CSC_LINK set"          -ForegroundColor Green

$p1    | gh secret set WIN_CSC_KEY_PASSWORD   --repo $repo
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to set WIN_CSC_KEY_PASSWORD secret" }
Write-Host "  ✓ WIN_CSC_KEY_PASSWORD set"  -ForegroundColor Green

# ── 7. Clean up local PFX ─────────────────────────────────────────────────────
Remove-Item $pfxPath -Force
# Also remove cert from store (no longer needed locally)
Remove-Item "Cert:\CurrentUser\My\$($cert.Thumbprint)" -Force
Write-Host "  ✓ Temp files cleaned up"    -ForegroundColor Green

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Cyan
Write-Host "The next release workflow run will automatically sign the Windows .exe"
Write-Host "Users will see 'Bracha Reminder' as the publisher instead of 'Unknown Publisher'."
Write-Host ""

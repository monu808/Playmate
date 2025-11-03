# 🚀 Deploy Firestore Rules - PowerShell Script

Write-Host "🔥 Firebase Firestore Rules Deployment Helper" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Check if firestore.rules exists
if (-Not (Test-Path "firestore.rules")) {
    Write-Host "❌ Error: firestore.rules file not found!" -ForegroundColor Red
    Write-Host "Make sure you're running this from the project root directory." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Found firestore.rules file" -ForegroundColor Green
Write-Host ""

# Read the rules file
$rulesContent = Get-Content "firestore.rules" -Raw

Write-Host "📋 Firestore Rules Preview (First 10 lines):" -ForegroundColor Yellow
Write-Host "--------------------------------------------" -ForegroundColor Yellow
(Get-Content "firestore.rules" -TotalCount 10) | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
Write-Host "... (truncated)" -ForegroundColor Gray
Write-Host ""

Write-Host "📊 Deployment Options:" -ForegroundColor Cyan
Write-Host "1. Open Firebase Console (Recommended - Manual Deploy)" -ForegroundColor White
Write-Host "2. Copy rules to clipboard" -ForegroundColor White
Write-Host "3. Show full rules content" -ForegroundColor White
Write-Host "4. Deploy using Firebase CLI (requires firebase-tools installed)" -ForegroundColor White
Write-Host "5. Exit" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Select option (1-5)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "🌐 Opening Firebase Console..." -ForegroundColor Green
        Start-Process "https://console.firebase.google.com/project/turf-booking-63618/firestore/rules"
        Write-Host ""
        Write-Host "📝 Next Steps:" -ForegroundColor Yellow
        Write-Host "1. The Firebase Console should open in your browser" -ForegroundColor White
        Write-Host "2. Copy the content from firestore.rules file" -ForegroundColor White
        Write-Host "3. Paste it into the rules editor in Firebase Console" -ForegroundColor White
        Write-Host "4. Click the 'Publish' button" -ForegroundColor White
        Write-Host "5. Wait 30 seconds for rules to propagate" -ForegroundColor White
    }
    "2" {
        Write-Host ""
        Write-Host "📋 Copying rules to clipboard..." -ForegroundColor Green
        Set-Clipboard -Value $rulesContent
        Write-Host "✅ Rules copied to clipboard!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📝 Next Steps:" -ForegroundColor Yellow
        Write-Host "1. Go to: https://console.firebase.google.com/project/turf-booking-63618/firestore/rules" -ForegroundColor White
        Write-Host "2. Select all existing content (Ctrl+A)" -ForegroundColor White
        Write-Host "3. Paste the rules (Ctrl+V)" -ForegroundColor White
        Write-Host "4. Click 'Publish'" -ForegroundColor White
        Write-Host ""
        Write-Host "🌐 Open Firebase Console now? (Y/N)" -ForegroundColor Cyan
        $openBrowser = Read-Host
        if ($openBrowser -eq "Y" -or $openBrowser -eq "y") {
            Start-Process "https://console.firebase.google.com/project/turf-booking-63618/firestore/rules"
        }
    }
    "3" {
        Write-Host ""
        Write-Host "📄 Full Firestore Rules Content:" -ForegroundColor Yellow
        Write-Host "================================" -ForegroundColor Yellow
        Write-Host $rulesContent -ForegroundColor Gray
        Write-Host ""
        Write-Host "Press any key to continue..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
    "4" {
        Write-Host ""
        Write-Host "🔥 Checking for Firebase CLI..." -ForegroundColor Yellow
        
        $firebaseCLI = Get-Command firebase -ErrorAction SilentlyContinue
        
        if ($null -eq $firebaseCLI) {
            Write-Host "❌ Firebase CLI not found!" -ForegroundColor Red
            Write-Host ""
            Write-Host "To install Firebase CLI:" -ForegroundColor Yellow
            Write-Host "npm install -g firebase-tools" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "After installation, run:" -ForegroundColor Yellow
            Write-Host "firebase login" -ForegroundColor Cyan
            Write-Host "firebase deploy --only firestore:rules" -ForegroundColor Cyan
        } else {
            Write-Host "✅ Firebase CLI found!" -ForegroundColor Green
            Write-Host ""
            Write-Host "🚀 Deploying rules..." -ForegroundColor Cyan
            firebase deploy --only firestore:rules
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "✅ Rules deployed successfully!" -ForegroundColor Green
                Write-Host "⏳ Wait 30 seconds for rules to propagate..." -ForegroundColor Yellow
            } else {
                Write-Host ""
                Write-Host "❌ Deployment failed!" -ForegroundColor Red
                Write-Host "You may need to run 'firebase login' first" -ForegroundColor Yellow
            }
        }
    }
    "5" {
        Write-Host ""
        Write-Host "👋 Exiting..." -ForegroundColor Gray
        exit 0
    }
    default {
        Write-Host ""
        Write-Host "❌ Invalid option!" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✨ Done! Check QUICK_FIX_GUIDE.md for verification steps." -ForegroundColor Green
Write-Host ""

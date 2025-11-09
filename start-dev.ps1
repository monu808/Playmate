# Quick Development Setup
# Use this if you already have a dev build installed

Write-Host "🚀 Starting Metro Bundler for Development..." -ForegroundColor Green

# Set paths
$env:ANDROID_HOME = 'D:\Android\Sdk'
$env:ANDROID_SDK_ROOT = 'D:\Android\Sdk'
$env:Path = "D:\Android\Sdk\platform-tools;D:\Android\Sdk\tools;D:\Android\Sdk\emulator;$env:Path"
$env:NODE_ENV = 'development'

Write-Host "✅ Environment configured" -ForegroundColor Green

# Clear Metro cache and start
Write-Host ""
Write-Host "🧹 Clearing Metro cache..." -ForegroundColor Yellow
npx expo start --clear

Write-Host ""
Write-Host "📱 Press 'a' in Metro terminal to open on Android" -ForegroundColor Cyan
Write-Host "   Or scan QR code with Expo Go app" -ForegroundColor Cyan

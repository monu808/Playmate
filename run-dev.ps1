# Run Development Build
# This script sets up Android SDK paths and runs the development build

Write-Host "🚀 Setting up Android SDK paths..." -ForegroundColor Green

# Set Android SDK paths for this session
$env:ANDROID_HOME = 'D:\Android\Sdk'
$env:ANDROID_SDK_ROOT = 'D:\Android\Sdk'
$env:Path = "D:\Android\Sdk\platform-tools;D:\Android\Sdk\tools;D:\Android\Sdk\emulator;$env:Path"

# Fix NODE_ENV issue
$env:NODE_ENV = 'development'

Write-Host "✅ Environment variables set" -ForegroundColor Green
Write-Host "   ANDROID_HOME: $env:ANDROID_HOME" -ForegroundColor Cyan
Write-Host "   NODE_ENV: $env:NODE_ENV" -ForegroundColor Cyan

# Check if emulator is running
Write-Host ""
Write-Host "📱 Checking emulator status..." -ForegroundColor Green
$devices = adb devices | Select-String -Pattern "emulator"

if ($devices) {
    Write-Host "✅ Emulator is running" -ForegroundColor Green
} else {
    Write-Host "⚠️  No emulator detected" -ForegroundColor Yellow
    Write-Host "   Starting emulator..." -ForegroundColor Yellow
    Start-Process -FilePath "emulator" -ArgumentList "-avd", "Pixel_4" -WindowStyle Hidden
    Write-Host "   Waiting 30 seconds for emulator to boot..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
}

# Clean and build
Write-Host ""
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Green
if (Test-Path "android\app\build") {
    Remove-Item -Recurse -Force "android\app\build"
}

# Run development build
Write-Host ""
Write-Host "🔨 Building and running development version..." -ForegroundColor Green
Write-Host "   This will take a few minutes on first run..." -ForegroundColor Cyan
Write-Host ""

npx expo run:android

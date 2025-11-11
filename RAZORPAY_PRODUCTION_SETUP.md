# 🔑 Production Razorpay Key Configuration Guide

## Overview
This guide explains how to configure Razorpay keys for production deployment.

---

## ⚠️ SECURITY WARNING
**NEVER commit live Razorpay keys to version control!**

- ✅ Test keys (`rzp_test_...`) are safe to commit
- ❌ Live keys (`rzp_live_...`) must NEVER be in Git

---

## Configuration Methods

### **Method 1: Client-Side (App)**

#### Option A: Environment Variable (Recommended)
Create `.env` file in project root:
```bash
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_YourLiveKeyHere
```

#### Option B: app.json (Team Sharing)
Update `app.json`:
```json
{
  "expo": {
    "extra": {
      "razorpayKeyId": "rzp_live_YourLiveKeyHere"
    }
  }
}
```

**Note:** Never commit `app.json` with live keys. Use `.gitignore` or EAS Secrets.

---

### **Method 2: Server-Side (Cloud Functions)**

#### For Firebase Cloud Functions:

**Step 1: Set via Firebase CLI**
```bash
cd functions
firebase functions:config:set razorpay.key_id="rzp_live_YourLiveKeyHere"
firebase functions:config:set razorpay.key_secret="your_live_secret_here"
```

**Step 2: Verify configuration**
```bash
firebase functions:config:get
```

**Step 3: Deploy functions**
```bash
firebase deploy --only functions
```

---

### **Method 3: EAS Build Secrets (Recommended for Expo)**

#### Step 1: Install EAS CLI
```bash
npm install -g eas-cli
```

#### Step 2: Login to EAS
```bash
eas login
```

#### Step 3: Create secrets
```bash
eas secret:create --scope project --name RAZORPAY_KEY_ID --value rzp_live_YourLiveKeyHere
eas secret:create --scope project --name RAZORPAY_KEY_SECRET --value your_live_secret_here
```

#### Step 4: Configure eas.json
```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_RAZORPAY_KEY_ID": "@RAZORPAY_KEY_ID"
      }
    }
  }
}
```

---

## How to Get Production Keys

### Step 1: Sign up for Razorpay
1. Go to https://razorpay.com/
2. Click "Sign Up" and complete registration
3. Complete KYC verification (required for live keys)

### Step 2: Activate Live Mode
1. Go to Razorpay Dashboard
2. Complete business verification
3. Wait for approval (24-48 hours)

### Step 3: Generate Live API Keys
1. Navigate to: Settings → API Keys
2. Click "Generate Live Keys"
3. **Copy and save immediately** (shown only once)
   - Key ID: `rzp_live_...`
   - Key Secret: `[secret]`

---

## Testing Before Going Live

### Use Razorpay Test Mode
```bash
# Test credentials (safe to commit)
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_RVSNX0MyGKgNm9
```

### Test Card Details
- **Card Number:** 4111 1111 1111 1111
- **CVV:** Any 3 digits
- **Expiry:** Any future date
- **OTP:** 123456

### Test UPI
- **UPI ID:** success@razorpay

---

## Production Checklist

Before switching to live keys:

- [ ] KYC verification completed
- [ ] Business documents verified
- [ ] Bank account linked
- [ ] Settlement configured
- [ ] Webhooks configured
- [ ] Test all payment flows
- [ ] Cloud Functions deployed
- [ ] Payment verification working
- [ ] Error handling tested
- [ ] Refund process tested
- [ ] Customer support ready

---

## Current Configuration Status

### Client (App)
- **File:** `lib/constants.ts`
- **Current:** Test key (`rzp_test_RVSNX0MyGKgNm9`)
- **Priority:** ENV → app.json → hardcoded fallback

### Server (Cloud Functions)
- **File:** `functions/src/index.ts`
- **Current:** Not deployed (using test key from config)
- **Set via:** `firebase functions:config:set`

---

## Security Best Practices

1. **Never log secret keys**
   ```typescript
   // ❌ BAD
   console.log('Secret:', RAZORPAY_KEY_SECRET);
   
   // ✅ GOOD
   console.log('Using Razorpay key ID:', RAZORPAY_KEY_ID.substring(0, 10) + '...');
   ```

2. **Verify on server-side**
   - Client gets key_id (public)
   - Server uses key_secret (private)
   - Always verify signature server-side

3. **Use environment variables**
   - Different keys for dev/staging/prod
   - Never hardcode in source files
   - Use .env and .gitignore

4. **Rotate keys regularly**
   - Generate new keys every 6 months
   - Revoke old keys after transition
   - Update all environments

---

## Troubleshooting

### "Invalid API key"
- Check key format: `rzp_test_...` or `rzp_live_...`
- Verify key is active in dashboard
- Check mode (test vs live)

### "Key Secret not set"
- Run: `firebase functions:config:get`
- Redeploy functions after setting config

### Payment fails in production
- Verify live keys are activated
- Check Razorpay account status
- Review webhook logs in dashboard

---

## Support

- **Razorpay Docs:** https://razorpay.com/docs/
- **Dashboard:** https://dashboard.razorpay.com/
- **Support:** support@razorpay.com

---

**Last Updated:** November 12, 2025  
**Version:** 1.0

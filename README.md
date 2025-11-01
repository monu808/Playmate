# Playmate - Turf Booking Mobile App

A full-featured React Native mobile app built with Expo for booking sports turfs, with integrated Firebase backend and Razorpay payments.

## 🚀 Tech Stack

- **Framework**: Expo SDK 54.0.0 with TypeScript
- **Navigation**: React Navigation (Stack + Bottom Tabs + Drawer)
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Payments**: Razorpay React Native SDK
- **Maps**: react-native-maps + Expo Location
- **Animations**: react-native-reanimated + Moti
- **Forms**: react-hook-form + yup validation
- **Styling**: StyleSheet API with custom theme system

## 📁 Project Structure

```
PlaymateApp/
├── app/                      # (To be created with Expo Router)
├── assets/                   # Images, icons, fonts
├── components/              # Reusable UI components
│   └── ui/                  # Base UI components
├── config/
│   └── firebase.ts          # Firebase configuration ✅
├── lib/
│   ├── constants.ts         # App constants ✅
│   ├── theme.ts             # Design system ✅
│   ├── utils.ts             # Utility functions ✅
│   └── payments/
│       └── razorpay.ts      # Payment logic ✅
├── navigation/
│   └── index.tsx            # Navigation setup ✅
├── screens/                 # Screen components
│   ├── Auth/
│   │   ├── LoginScreen.tsx  # Login screen ✅
│   │   └── SignupScreen.tsx # Signup screen ✅
│   ├── HomeScreen.tsx       # Home screen ✅
│   ├── BookingsScreen.tsx   # Bookings screen ✅
│   ├── ProfileScreen.tsx    # Profile screen ✅
│   └── TurfDetailScreen.tsx # Turf details ✅
├── types/
│   └── index.ts             # TypeScript types ✅
├── app.json                 # Expo configuration
├── package.json             # Dependencies
└── tsconfig.json            # TypeScript config
```

## ✅ Completed Setup

### 1. Core Configuration
- ✅ Theme system with exact website colors (green primary #16a34a)
- ✅ Typography system (font sizes, weights, line heights)
- ✅ Spacing system (8pt grid)
- ✅ Shadow system for elevation
- ✅ Border radius tokens

### 2. TypeScript Types
- ✅ Navigation types (RootStack, MainTabs)
- ✅ User, Turf, Booking interfaces
- ✅ PaymentBreakdown interface (CRITICAL)
- ✅ Form data types
- ✅ Transaction types

### 3. Utilities & Constants
- ✅ Payment calculation functions (Rs 25 commission + 2.07% fee)
- ✅ Date/time formatting
- ✅ Validation functions (email, phone, password)
- ✅ Distance calculation (Haversine formula)
- ✅ Slot availability checking
- ✅ Debounce helper
- ✅ App constants (time slots, amenities, status codes)

### 4. Firebase Integration
- ✅ Firebase Auth with AsyncStorage persistence
- ✅ Firestore database connection
- ✅ Storage for images
- ✅ Proper TypeScript types
- ✅ Auth state handling (hot reload support)

### 5. Payment System
- ✅ Razorpay payment calculations
- ✅ Payment breakdown formatter
- ✅ Payment validation
- ✅ Commission logic (Rs 25 + 2.07% gateway fee)

### 6. Dependencies Installed
- ✅ React Navigation (stack, tabs, drawer)
- ✅ react-native-gesture-handler
- ✅ react-native-reanimated
- ✅ react-native-screens
- ✅ react-native-safe-area-context
- ✅ moti (animations)
- ✅ react-native-maps
- ✅ expo-location
- ✅ expo-image-picker
- ✅ expo-image-manipulator
- ✅ expo-image
- ✅ expo-notifications
- ✅ react-hook-form
- ✅ yup
- ✅ @hookform/resolvers
- ✅ react-native-razorpay
- ✅ date-fns
- ✅ @react-native-async-storage/async-storage

## 🎨 Design System

### Colors
```typescript
Primary Green: #16a34a
Success: #10b981
Warning: #f59e0b
Error: #ef4444
```

### Typography
- Font sizes: xs(12) - 4xl(36)
- Weights: normal, medium, semibold, bold
- System fonts (SF Pro on iOS, Roboto on Android)

### Spacing
- Based on 8pt grid system
- xs(4), sm(8), md(12), lg(16), xl(24), 2xl(32), 3xl(48), 4xl(64)

## 💳 Payment System (CRITICAL)

The app uses a commission-based payment model:

```
Base Turf Amount: ₹1000 (example: 2 hours × ₹500/hr)
Platform Fee: ₹25 (fixed)
Subtotal: ₹1025
Payment Gateway (2.07%): ₹21.21
─────────────────────────
Total Amount: ₹1046.21

Owner receives: ₹1000
Platform receives: ₹25 - (₹25 × 0.0207) = ₹24.48
Razorpay fee: ₹21.73
```

## 🔧 Next Steps

### Immediate Tasks
1. ⏳ Create reusable UI components (Button, Input, Card, Modal, etc.)
2. ⏳ Setup Auth Context for state management
3. ⏳ Update LoginScreen and SignupScreen with new components
4. ⏳ Build Home Screen with turf listings
5. ⏳ Create Turf Detail Screen with booking flow
6. ⏳ Implement Booking Modal with payment breakdown
7. ⏳ Build My Bookings screen
8. ⏳ Create Map/Explore screen
9. ⏳ Build Profile screen
10. ⏳ Create Admin Dashboard and management screens
11. ⏳ Add animations and polish
12. ⏳ Update app.json configuration
13. ⏳ Testing and bug fixes

## 🔥 Firebase Configuration

The app is connected to the existing Firebase project:
- Project ID: `turf-booking-63618`
- Auth: Email/Password with AsyncStorage persistence
- Database: Firestore
- Storage: Firebase Storage for images

## 📱 Running the App

```bash
# Start development server
npx expo start

# Run on iOS
npx expo start --ios

# Run on Android
npx expo start --android

# Clear cache
npx expo start --clear
```

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Type check
npx tsc --noEmit
```

## 📦 Build & Deploy

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure project
eas build:configure

# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios
```

## 🔑 Environment Variables

Add these to `app.json` extra field:
- `firebaseApiKey`
- `firebaseAuthDomain`
- `firebaseProjectId`
- `firebaseStorageBucket`
- `firebaseMessagingSenderId`
- `firebaseAppId`
- `razorpayKeyId`

## 📝 Important Notes

1. **Payment Commission**: The Rs 25 commission + 2.07% fee logic is implemented in `lib/payments/razorpay.ts` and `lib/utils.ts`
2. **Firebase**: Using the same Firebase project as the website for shared backend
3. **Navigation**: Currently using React Navigation, will be migrated to Expo Router if needed
4. **Theme**: All colors and design tokens match the website exactly
5. **TypeScript**: Full type safety throughout the app

## 🐛 Known Issues

- None yet - freshly set up!

## 📚 Documentation

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Razorpay Documentation](https://razorpay.com/docs/)

## 👥 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

Private project - All rights reserved

---

**Status**: 🟡 In Progress (Core setup complete, UI implementation in progress)

**Last Updated**: {{ current_date }}

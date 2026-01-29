// Firebase Configuration for Playmate App
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import functions from '@react-native-firebase/functions';
// TODO: Fix App Check bundling error - "Unable to resolve './version'"
// import appCheck from '@react-native-firebase/app-check';

const firebaseConfig = {
  apiKey: "AIzaSyCHOWM71qRhxoE2zkEgPTX4xu4bF1m9gVQ",
  authDomain: "turf-booking-63618.firebaseapp.com",
  projectId: "turf-booking-63618",
  storageBucket: "turf-booking-63618.firebasestorage.app",
  messagingSenderId: "717547014679",
  appId: "1:717547014679:web:ae80905698fd97b9a0ea52",
  measurementId: "G-F1EM7861QX"
};

// Initialize Firebase
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// React Native Firebase is auto-initialized from google-services.json
// Auth, Firestore, and Storage are accessed via their respective functions
const db = firestore();
const storageInstance = storage();
const functionsInstance = functions();

// TODO: Re-enable App Check once package bundling issue is fixed
// Initialize App Check with Play Integrity for production phone auth
/*
const initAppCheck = async () => {
  try {
    // Use debug token for development
    if (__DEV__) {
      await appCheck().initializeAppCheck({
        android: {
          provider: 'debug',
          debugToken: 'YOUR_DEBUG_TOKEN', // Will be auto-generated
        },
        isTokenAutoRefreshEnabled: true,
      });
      console.log('✅ App Check initialized with Debug provider for development');
    } else {
      await appCheck().initializeAppCheck({
        android: {
          provider: 'playIntegrity',
        },
        isTokenAutoRefreshEnabled: true,
      });
      console.log('✅ App Check initialized with Play Integrity for production');
    }
  } catch (error: any) {
    console.warn('⚠️ App Check initialization failed:', error.message);
    console.warn('Phone auth will still work with test phone numbers');
  }
};

// Initialize App Check
initAppCheck();
*/

console.log('🔥 Firebase initialized');

export { app, auth, db, storageInstance as storage, functionsInstance as functions };

// Firebase Configuration for Playmate App
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import with type assertion since getReactNativePersistence exists at runtime
const { getReactNativePersistence } = require('firebase/auth') as any;

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

// Initialize Auth with AsyncStorage persistence for React Native
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (error: any) {
  // If auth is already initialized (e.g., during hot reload), just get it
  if (error.code === 'auth/already-initialized') {
    auth = getAuth(app);
  } else {
    throw error;
  }
}

const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

console.log('🔥 Firebase initialized');

export { app, auth, db, storage };

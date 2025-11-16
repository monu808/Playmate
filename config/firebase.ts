// Firebase Configuration for Playmate App
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFunctions, Functions } from 'firebase/functions';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

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
const functions: Functions = getFunctions(app);

console.log('🔥 Firebase initialized');

export { app, auth, db, storageInstance as storage, functions };

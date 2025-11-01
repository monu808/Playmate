// Firebase Auth Functions
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { User } from '../../types';

/**
 * Sign in with email and password
 */
export const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error: any) {
    console.error('Sign in error:', error);
    return {
      success: false,
      error: error.message || 'Failed to sign in',
    };
  }
};

/**
 * Sign up with email and password
 */
export const signUp = async (
  email: string,
  password: string,
  name: string,
  phoneNumber?: string
) => {
  try {
    // Create auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update profile
    await updateProfile(user, {
      displayName: name,
    });

    // Create user document in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      name,
      email,
      phoneNumber: phoneNumber || '',
      role: 'user',
      createdAt: new Date(),
    });

    return { success: true, user };
  } catch (error: any) {
    console.error('Sign up error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create account',
    };
  }
};

/**
 * Sign out
 */
export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
    return { success: true };
  } catch (error: any) {
    console.error('Sign out error:', error);
    return {
      success: false,
      error: error.message || 'Failed to sign out',
    };
  }
};

/**
 * Get current user
 */
export const getCurrentUser = (): FirebaseUser | null => {
  return auth.currentUser;
};

/**
 * Get user data from Firestore
 */
export const getUserData = async (uid: string): Promise<User | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as User;
    }
    return null;
  } catch (error) {
    console.error('Get user data error:', error);
    return null;
  }
};

/**
 * Subscribe to auth state changes
 */
export const subscribeToAuthChanges = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  uid: string,
  data: Partial<User>
) => {
  try {
    await setDoc(doc(db, 'users', uid), data, { merge: true });
    return { success: true };
  } catch (error: any) {
    console.error('Update profile error:', error);
    return {
      success: false,
      error: error.message || 'Failed to update profile',
    };
  }
};

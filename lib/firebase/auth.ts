// Firebase Auth Functions
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, uploadString } from 'firebase/storage';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { auth, db, storage } from '../../config/firebase';
import { User } from '../../types';
import { isAdminEmail, initializeAdminUser } from './admin';

WebBrowser.maybeCompleteAuthSession();

/**
 * Sign in with Google using Expo AuthSession
 */
export const signInWithGoogle = async () => {
  try {
    // Google Sign-In is now implemented in LoginScreen component
    // This function is kept for backwards compatibility
    return {
      success: false,
      error: 'Google Sign-In requires component-level implementation. Please use the LoginScreen.',
    };
  } catch (error: any) {
    console.error('Google sign in error:', error);
    return {
      success: false,
      error: error.message || 'Failed to sign in with Google',
    };
  }
};

/**
 * Process Google sign-in response
 */
export const processGoogleSignIn = async (idToken: string) => {
  try {
    // Create Firebase credential from Google ID token
    const credential = GoogleAuthProvider.credential(idToken);
    
    // Sign in to Firebase
    const userCredential = await signInWithCredential(auth, credential);
    const firebaseUser = userCredential.user;
    
    // Check if user document exists
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    
    if (!userDoc.exists()) {
      // Create user document for new users
      const userData: User = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        name: firebaseUser.displayName || 'Google User',
        phoneNumber: firebaseUser.phoneNumber || undefined,
        photoURL: firebaseUser.photoURL || undefined,
        role: 'user',
        createdAt: new Date(),
      };
      
      await setDoc(doc(db, 'users', firebaseUser.uid), userData);
      
      // Initialize admin if email is in admin list
      if (firebaseUser.email) {
        await initializeAdminUser(firebaseUser.uid, firebaseUser.email);
      }
    }
    
    return { success: true, user: firebaseUser };
  } catch (error: any) {
    console.error('Process Google sign in error:', error);
    return {
      success: false,
      error: error.message || 'Failed to complete Google sign in',
    };
  }
};

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
  phoneNumber?: string,
  role: 'user' | 'owner' = 'user',
  businessName?: string
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
    const userData: any = {
      uid: user.uid,
      displayName: name,
      email,
      phoneNumber: phoneNumber || '',
      role,
      createdAt: new Date(),
    };

    // Add business name for owners
    if (role === 'owner' && businessName) {
      userData.businessName = businessName;
    }

    await setDoc(doc(db, 'users', user.uid), userData);

    // Initialize admin if email is in admin list (overrides role selection)
    await initializeAdminUser(user.uid, email);

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
    
    // Also update Firebase Auth profile if displayName or photoURL changed
    if (auth.currentUser && (data.name || data.photoURL)) {
      await updateProfile(auth.currentUser, {
        displayName: data.name,
        photoURL: data.photoURL,
      });
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Update profile error:', error);
    return {
      success: false,
      error: error.message || 'Failed to update profile',
    };
  }
};

/**
 * Upload profile image to Firebase Storage
 */
export const uploadProfileImage = async (
  uid: string,
  imageUri: string
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    console.log('📤 Starting image upload for user:', uid);
    console.log('📷 Image URI:', imageUri);

    // Fetch the image and convert to blob
    const response = await fetch(imageUri);
    const blob = await response.blob();
    console.log('✅ Image converted to blob, size:', blob.size);

    // Create storage reference
    const filename = `profile-${uid}_${Date.now()}.jpg`;
    const storageRef = ref(storage, `turfs/${filename}`);
    console.log('📁 Storage reference created:', `turfs/${filename}`);

    // Upload blob directly
    console.log('⬆️ Uploading image...');
    const uploadResult = await uploadBytes(storageRef, blob, {
      contentType: 'image/jpeg',
    });
    console.log('✅ Image uploaded successfully');

    // Get download URL
    console.log('🔗 Getting download URL...');
    const downloadURL = await getDownloadURL(storageRef);
    console.log('✅ Download URL obtained:', downloadURL);

    // Update user profile with photo URL
    console.log('💾 Updating user profile...');
    await updateUserProfile(uid, { photoURL: downloadURL });
    console.log('✅ Profile updated with new photo URL');

    return { success: true, url: downloadURL };
  } catch (error: any) {
    console.error('❌ Upload profile image error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    let userMessage = 'Failed to upload image';
    if (error.code === 'storage/unauthorized') {
      userMessage = 'Storage permission denied. Please check Firebase Storage rules.';
    } else if (error.code === 'storage/unknown') {
      userMessage = 'Storage configuration error. Please ensure Firebase Storage is enabled in your Firebase console.';
    } else if (error.message) {
      userMessage = error.message;
    }
    
    return {
      success: false,
      error: userMessage,
    };
  }
};

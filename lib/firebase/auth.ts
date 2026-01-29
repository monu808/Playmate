// Firebase Auth Functions
import auth from '@react-native-firebase/auth';
import { db, storage } from '../../config/firebase';
import { User } from '../../types';
import { isAdminEmail, initializeAdminUser } from './admin';

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

// processGoogleSignIn function removed - Google Sign-In is now handled directly in LoginScreen

/**
 * Sign in with email and password
 */
export const signIn = async (email: string, password: string) => {
  try {
    console.log('🔐 Attempting to sign in with email:', email);
    
    const userCredential = await auth().signInWithEmailAndPassword(email, password);
    console.log('✅ Sign in successful!');
    return { success: true, user: userCredential.user };
  } catch (error: any) {
    console.error('❌ Sign in error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    let userMessage = 'Failed to sign in';
    
    if (error.code === 'auth/network-request-failed') {
      userMessage = 'Network error: Please check your internet connection. Make sure your device has internet access.';
    } else if (error.code === 'auth/user-not-found') {
      userMessage = 'No account found with this email.';
    } else if (error.code === 'auth/wrong-password') {
      userMessage = 'Incorrect password.';
    } else if (error.code === 'auth/invalid-email') {
      userMessage = 'Invalid email address.';
    } else if (error.code === 'auth/user-disabled') {
      userMessage = 'This account has been disabled.';
    } else if (error.message) {
      userMessage = error.message;
    }
    
    return {
      success: false,
      error: userMessage,
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
    const userCredential = await auth().createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // Update profile
    await user.updateProfile({
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

    await db.collection('users').doc(user.uid).set(userData);

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
    await auth().signOut();
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
export const getCurrentUser = () => {
  return auth().currentUser;
};

/**
 * Get user data from Firestore
 */
export const getUserData = async (uid: string): Promise<{ success: boolean; user?: User; error?: string }> => {
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists()) {
      return { success: true, user: userDoc.data() as User };
    }
    return { success: false, error: 'User not found' };
  } catch (error: any) {
    console.error('Get user data error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Subscribe to auth state changes
 */
export const subscribeToAuthChanges = (callback: (user: any) => void) => {
  return auth().onAuthStateChanged(callback);
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  uid: string,
  data: Partial<User>
) => {
  try {
    // Check if document exists first
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      // Document doesn't exist, create it with minimal required fields
      const currentUser = auth().currentUser;
      const userData: Partial<User> = {
        uid,
        email: currentUser?.email || null,
        role: 'user',
        createdAt: new Date(),
        ...data, // Merge with the data being updated
      };
      await db.collection('users').doc(uid).set(userData);
    } else {
      // Document exists, update it
      await db.collection('users').doc(uid).update(data);
    }
    
    // Also update Firebase Auth profile if displayName or photoURL changed
    const currentUser = auth().currentUser;
    if (currentUser && (data.name || data.photoURL)) {
      await currentUser.updateProfile({
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

    // Create storage reference - path should match storage rules
    const filename = `profile_${Date.now()}.jpg`;
    const storageRef = storage.ref(`profiles/${uid}/${filename}`);
    console.log('📁 Storage reference created:', `profiles/${uid}/${filename}`);

    // Upload file directly using React Native Firebase Storage
    console.log('⬆️ Uploading image...');
    await storageRef.putFile(imageUri);
    console.log('✅ Image uploaded successfully');

    // Get download URL
    console.log('🔗 Getting download URL...');
    const downloadURL = await storageRef.getDownloadURL();
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

/**
 * Send OTP to phone number
 * Returns confirmation object that can be used to verify the code
 */
export const sendPhoneOTP = async (phoneNumber: string) => {
  try {
    console.log('📱 Sending OTP to:', phoneNumber);
    
    // Firebase requires phone number in E.164 format (e.g., +919876543210)
    const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
    console.log('✅ OTP sent successfully');
    
    return {
      success: true,
      confirmation,
    };
  } catch (error: any) {
    console.error('❌ Send OTP error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    let userMessage = 'Failed to send OTP';
    
    if (error.code === 'auth/invalid-phone-number') {
      userMessage = 'Invalid phone number format. Use format: +91XXXXXXXXXX';
    } else if (error.code === 'auth/too-many-requests') {
      userMessage = 'Too many attempts. Please try again later.';
    } else if (error.code === 'auth/quota-exceeded') {
      userMessage = 'SMS quota exceeded. Please try again later.';
    } else if (error.message) {
      userMessage = error.message;
    }
    
    return {
      success: false,
      error: userMessage,
    };
  }
};

/**
 * Verify OTP and complete phone authentication
 */
export const verifyPhoneOTP = async (
  confirmation: any,
  code: string
): Promise<{ success: boolean; user?: any; error?: string; isNewUser?: boolean }> => {
  try {
    console.log('🔐 Verifying OTP code...');
    
    // Confirm the code
    const userCredential = await confirmation.confirm(code);
    console.log('✅ Phone number verified successfully!');
    
    const firebaseUser = userCredential.user;
    
    // Check if user document exists in Firestore
    const userDoc = await db.collection('users').doc(firebaseUser.uid).get();
    const isNewUser = !userDoc.exists();
    
    if (isNewUser) {
      console.log('🆕 New user - creating user document...');
      const userData = {
        uid: firebaseUser.uid,
        phoneNumber: firebaseUser.phoneNumber || '',
        name: firebaseUser.displayName || 'User',
        role: 'user',
        createdAt: new Date(),
      };
      
      await db.collection('users').doc(firebaseUser.uid).set(userData);
      console.log('✅ User document created');
    } else {
      console.log('✅ Existing user signed in');
    }
    
    return {
      success: true,
      user: firebaseUser,
      isNewUser,
    };
  } catch (error: any) {
    console.error('❌ Verify OTP error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    let userMessage = 'Failed to verify OTP';
    
    if (error.code === 'auth/invalid-verification-code') {
      userMessage = 'Invalid OTP. Please check the code and try again.';
    } else if (error.code === 'auth/code-expired') {
      userMessage = 'OTP expired. Please request a new code.';
    } else if (error.message) {
      userMessage = error.message;
    }
    
    return {
      success: false,
      error: userMessage,
    };
  }
};


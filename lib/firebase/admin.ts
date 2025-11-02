import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

// Admin credentials - In production, store this securely or use Firebase Admin SDK
const ADMIN_EMAILS = [
  'admin@playmate.com',
  // Add more admin emails here
];

export interface AdminUser {
  uid: string;
  email: string;
  isAdmin: boolean;
  adminSince?: Date;
  permissions?: {
    manageTurfs: boolean;
    manageBookings: boolean;
    manageUsers: boolean;
    viewAnalytics: boolean;
  };
}

/**
 * Check if a user is an admin
 */
export const isAdmin = async (uid: string): Promise<boolean> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data()?.isAdmin === true;
    }
    return false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

/**
 * Check if an email is an admin email
 */
export const isAdminEmail = (email: string): boolean => {
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

/**
 * Grant admin privileges to a user
 */
export const grantAdminAccess = async (uid: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      isAdmin: true,
      adminSince: new Date(),
      permissions: {
        manageTurfs: true,
        manageBookings: true,
        manageUsers: true,
        viewAnalytics: true,
      },
    });
    return { success: true };
  } catch (error: any) {
    console.error('Error granting admin access:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Revoke admin privileges from a user
 */
export const revokeAdminAccess = async (uid: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      isAdmin: false,
      permissions: null,
    });
    return { success: true };
  } catch (error: any) {
    console.error('Error revoking admin access:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get admin user details
 */
export const getAdminUser = async (uid: string): Promise<AdminUser | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists() && userDoc.data()?.isAdmin) {
      return {
        uid: userDoc.id,
        email: userDoc.data().email,
        isAdmin: true,
        adminSince: userDoc.data().adminSince?.toDate(),
        permissions: userDoc.data().permissions,
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting admin user:', error);
    return null;
  }
};

/**
 * Initialize admin user on first sign up/sign in
 * Call this after user creation if email is in ADMIN_EMAILS
 */
export const initializeAdminUser = async (uid: string, email: string): Promise<void> => {
  if (isAdminEmail(email)) {
    await grantAdminAccess(uid);
    console.log('Admin access granted to:', email);
  }
};

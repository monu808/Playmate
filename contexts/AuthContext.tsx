// Auth Context Provider
import React, { createContext, useState, useEffect, useContext } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { getUserData } from '../lib/firebase/auth';
import { User } from '../types';
import { setCrashlyticsUser } from '../lib/crashlytics';
import { initializeNotifications } from '../lib/notifications';

interface AuthContextType {
  user: FirebaseAuthTypes.User | null;
  userData: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  isAuthenticated: false,
  refreshUserData: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Function to refresh user data from Firestore
  const refreshUserData = async () => {
    const currentUser = auth().currentUser;
    if (currentUser) {
      const result = await getUserData(currentUser.uid);
      setUserData(result.success ? result.user || null : null);
    }
  };

  useEffect(() => {
    let unsubscribeNotifications: (() => void) | null = null;
    let notificationsInitialized = false;

    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Fetch user data from Firestore
        const result = await getUserData(firebaseUser.uid);
        setUserData(result.success ? result.user || null : null);
        
        // ✅ PRODUCTION: Set Crashlytics user for better crash tracking
        try {
          await setCrashlyticsUser(
            firebaseUser.uid,
            firebaseUser.email || undefined,
            firebaseUser.displayName || undefined
          );
        } catch (error) {
          console.error('Failed to set Crashlytics user:', error);
        }

        // ✅ Initialize FCM notifications only once
        if (!notificationsInitialized) {
          try {
            unsubscribeNotifications = await initializeNotifications(firebaseUser.uid);
            notificationsInitialized = true;
            console.log('🔔 Notification listeners registered');
          } catch (error) {
            console.error('Failed to initialize notifications:', error);
          }
        }
      } else {
        setUserData(null);
        // Clean up notification listeners on logout
        if (unsubscribeNotifications) {
          unsubscribeNotifications();
          unsubscribeNotifications = null;
          notificationsInitialized = false;
          console.log('🔕 Notification listeners cleaned up');
        }
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribe();
      // Clean up notification listeners when component unmounts
      if (unsubscribeNotifications) {
        unsubscribeNotifications();
        console.log('🔕 Notification listeners cleaned up on unmount');
      }
    };
  }, []);

  const value = {
    user,
    userData,
    loading,
    isAuthenticated: !!user,
    refreshUserData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

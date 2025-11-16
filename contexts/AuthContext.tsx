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
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  isAuthenticated: false,
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

  useEffect(() => {
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

        // ✅ Initialize FCM notifications
        try {
          await initializeNotifications(firebaseUser.uid);
        } catch (error) {
          console.error('Failed to initialize notifications:', error);
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    user,
    userData,
    loading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

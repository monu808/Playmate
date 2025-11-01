// Auth Context Provider
import React, { createContext, useState, useEffect, useContext } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { subscribeToAuthChanges, getCurrentUser, getUserData } from '../lib/firebase/auth';
import { User } from '../types';

interface AuthContextType {
  user: FirebaseUser | null;
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
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Fetch user data from Firestore
        const data = await getUserData(firebaseUser.uid);
        setUserData(data);
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

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from '../components/ui';
import { isAdmin } from '../lib/firebase/admin';
import { SplashScreen } from '../components/SplashScreen';
import { OnboardingScreen } from '../components/OnboardingScreen';

// User Screens
import HomeScreen from '../screens/HomeScreen';
import TurfDetailScreen from '../screens/TurfDetailScreen';
import BookingsScreen from '../screens/BookingsScreen';
import ProfileScreen from '../screens/ProfileScreen';

// Auth Screens
import LoginScreen from '../screens/Auth/LoginScreen';
import SignupScreen from '../screens/Auth/SignupScreen';

// Admin Screens
import AdminDashboardScreen from '../screens/Admin/AdminDashboardScreen';
import ManageTurfsScreen from '../screens/Admin/ManageTurfsScreen';
import AdminBookingsScreen from '../screens/Admin/AdminBookingsScreen';
import ManageUsersScreen from '../screens/Admin/ManageUsersScreen';
import AnalyticsScreen from '../screens/Admin/AnalyticsScreen';
import AddTurfScreen from '../screens/Admin/AddTurfScreenEnhanced';
import ScanQRScreen from '../screens/Admin/ScanQRScreen';
import PendingTurfsScreen from '../screens/Admin/PendingTurfsScreen';

// Owner Screens
import OwnerDashboardScreen from '../screens/Owner/OwnerDashboardScreen';
import MyTurfsScreen from '../screens/Owner/MyTurfsScreen';
import AddOwnerTurfScreen from '../screens/Owner/AddTurfScreen';
import OwnerBookingsScreen from '../screens/Owner/OwnerBookingsScreen';
import OwnerScanQRScreen from '../screens/Owner/OwnerScanQRScreen';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Admin: undefined;
  Owner: undefined;
  TurfDetail: { id: string };
  AddTurf: undefined;
  OwnerScanQR: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Bookings: undefined;
  Profile: undefined;
};

export type AdminStackParamList = {
  AdminDashboard: undefined;
  ManageTurfs: undefined;
  AddTurf: undefined;
  AdminBookings: undefined;
  ManageUsers: undefined;
  Analytics: undefined;
  ScanQR: undefined;
  PendingTurfs: undefined;
};

export type OwnerTabParamList = {
  OwnerDashboard: undefined;
  MyTurfs: undefined;
  OwnerBookings: undefined;
  OwnerProfile: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const AuthStack = createStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const AdminStack = createStackNavigator<AdminStackParamList>();
const OwnerTab = createBottomTabNavigator<OwnerTabParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

function AdminNavigator() {
  return (
    <AdminStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <AdminStack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <AdminStack.Screen name="ScanQR" component={ScanQRScreen} />
      <AdminStack.Screen name="ManageTurfs" component={ManageTurfsScreen} />
      <AdminStack.Screen name="PendingTurfs" component={PendingTurfsScreen} />
      <AdminStack.Screen name="AddTurf" component={AddTurfScreen} />
      <AdminStack.Screen name="AdminBookings" component={AdminBookingsScreen} />
      <AdminStack.Screen name="ManageUsers" component={ManageUsersScreen} />
      <AdminStack.Screen name="Analytics" component={AnalyticsScreen} />
    </AdminStack.Navigator>
  );
}

function OwnerTabs() {
  return (
    <OwnerTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'OwnerDashboard') {
            iconName = focused ? 'grid' : 'grid-outline';
          } else if (route.name === 'MyTurfs') {
            iconName = focused ? 'football' : 'football-outline';
          } else if (route.name === 'OwnerBookings') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'OwnerProfile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#10b981',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <OwnerTab.Screen 
        name="OwnerDashboard" 
        component={OwnerDashboardScreen}
        options={{ tabBarLabel: 'Dashboard' }}
      />
      <OwnerTab.Screen 
        name="MyTurfs" 
        component={MyTurfsScreen}
        options={{ tabBarLabel: 'My Turfs' }}
      />
      <OwnerTab.Screen 
        name="OwnerBookings" 
        component={OwnerBookingsScreen}
        options={{ tabBarLabel: 'Bookings' }}
      />
      <OwnerTab.Screen 
        name="OwnerProfile" 
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </OwnerTab.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Bookings') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#10b981',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Bookings" component={BookingsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const { isAuthenticated, loading, user, userData } = useAuth();
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  // Check user role - MEMOIZED
  useEffect(() => {
    async function checkUserRole() {
      if (user?.uid && userData) {
        // Check if user is admin
        const adminStatus = await isAdmin(user.uid);
        setUserIsAdmin(adminStatus);
      } else {
        setUserIsAdmin(false);
      }
      setCheckingRole(false);
    }

    if (isAuthenticated && user) {
      checkUserRole();
    } else {
      setCheckingRole(false);
      setUserIsAdmin(false);
    }
  }, [isAuthenticated, user, userData]);

  // Check if user has seen onboarding
  useEffect(() => {
    async function checkOnboarding() {
      try {
        const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
        if (!hasSeenOnboarding && !isAuthenticated) {
          setShowOnboarding(true);
        }
      } catch (error) {
        console.error('Error checking onboarding:', error);
      } finally {
        setCheckingOnboarding(false);
      }
    }
    checkOnboarding();
  }, [isAuthenticated]);

  // Handle splash screen dismissal
  useEffect(() => {
    if (showSplash && isAuthenticated) {
      // Show splash only for authenticated users
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 3000); // Match the duration in SplashScreen component
      return () => clearTimeout(timer);
    } else if (!isAuthenticated) {
      // Skip splash for non-authenticated users
      setShowSplash(false);
    }
  }, [showSplash, isAuthenticated]);

  // PERFORMANCE: Memoize user role calculation (must be before any returns)
  const role = useMemo(() => {
    if (!isAuthenticated || !userData) return 'guest';
    if (userIsAdmin || userData.role === 'admin') return 'admin';
    if (userData.role === 'owner') return 'owner';
    return 'user';
  }, [isAuthenticated, userData, userIsAdmin]);

  // Handle onboarding completion
  const handleOnboardingComplete = async () => {
    try {
      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
      setShowOnboarding(false);
    } catch (error) {
      console.error('Error saving onboarding status:', error);
      setShowOnboarding(false);
    }
  };

  // Show onboarding for new users
  if (showOnboarding && !isAuthenticated && !checkingOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  // Show splash screen for authenticated users
  if (showSplash && isAuthenticated) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // Show loading screen while checking auth state
  if (loading || checkingRole || checkingOnboarding) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : role === 'admin' ? (
          <>
            <Stack.Screen name="Admin" component={AdminNavigator} />
            <Stack.Screen 
              name="TurfDetail" 
              component={TurfDetailScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : role === 'owner' ? (
          <>
            <Stack.Screen name="Owner" component={OwnerTabs} />
            <Stack.Screen 
              name="TurfDetail" 
              component={TurfDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="AddTurf" 
              component={AddOwnerTurfScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="OwnerScanQR" 
              component={OwnerScanQRScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen 
              name="TurfDetail" 
              component={TurfDetailScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
});

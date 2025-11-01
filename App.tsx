import React from 'react';
import { StatusBar } from 'expo-status-bar';
import Navigation from './navigation';
import { AuthProvider } from './contexts/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <Navigation />
        <StatusBar style="auto" />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}


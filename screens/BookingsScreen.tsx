import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function BookingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>My Bookings</Text>
      <Text style={styles.info}>Coming soon: View and manage your bookings!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 20,
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  info: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});

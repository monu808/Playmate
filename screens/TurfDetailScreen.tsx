import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function TurfDetailScreen({ route }: any) {
  const { turfId } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Turf Detail Screen</Text>
      <Text style={styles.subtext}>Turf ID: {turfId}</Text>
      <Text style={styles.info}>Coming soon: Full turf details, booking calendar, and more!</Text>
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
    marginBottom: 8,
  },
  subtext: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 16,
  },
  info: {
    fontSize: 14,
    color: '#10b981',
    textAlign: 'center',
  },
});

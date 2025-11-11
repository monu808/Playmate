/**
 * Error Boundary Component
 * Catches React errors and prevents app crashes
 * ✅ FIX #10: Added to improve app stability
 * ✅ PRODUCTION: Integrated with Firebase Crashlytics
 */

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../lib/theme';
import { logError, logMessage } from '../lib/crashlytics';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console for debugging
    console.error('🚨 Error Boundary Caught Error:', error);
    console.error('🚨 Error Info:', errorInfo);
    
    // ✅ PRODUCTION: Log to Firebase Crashlytics
    try {
      logMessage(`Error Boundary Caught: ${error.name}`);
      logMessage(`Component Stack: ${errorInfo.componentStack}`);
      logError(error, 'ErrorBoundary');
    } catch (crashlyticsError) {
      console.error('Failed to log to Crashlytics:', crashlyticsError);
    }
    
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            {/* Error Icon */}
            <View style={styles.iconContainer}>
              <Ionicons name="alert-circle" size={80} color={colors.error[500]} />
            </View>

            {/* Error Message */}
            <Text style={styles.title}>Oops! Something went wrong</Text>
            <Text style={styles.message}>
              The app encountered an unexpected error. Please try restarting or contact support if the problem persists.
            </Text>

            {/* Error Details (in development) */}
            {__DEV__ && this.state.error && (
              <ScrollView style={styles.errorDetails}>
                <Text style={styles.errorTitle}>Error Details (Dev Mode):</Text>
                <Text style={styles.errorText}>{this.state.error.toString()}</Text>
                {this.state.errorInfo && (
                  <>
                    <Text style={styles.errorTitle}>Component Stack:</Text>
                    <Text style={styles.errorText}>{this.state.errorInfo.componentStack}</Text>
                  </>
                )}
              </ScrollView>
            )}

            {/* Reset Button */}
            <TouchableOpacity style={styles.button} onPress={this.handleReset}>
              <Ionicons name="refresh" size={20} color="#ffffff" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>

            {/* Additional Help Text */}
            <Text style={styles.helpText}>
              If this keeps happening, please restart the app completely.
            </Text>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  content: {
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray[900],
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  message: {
    fontSize: 16,
    color: colors.gray[600],
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  errorDetails: {
    width: '100%',
    maxHeight: 200,
    backgroundColor: colors.gray[100],
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.error[600],
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: 11,
    color: colors.gray[700],
    marginBottom: spacing.md,
    fontFamily: 'monospace',
  },
  button: {
    flexDirection: 'row',
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonIcon: {
    marginRight: spacing.sm,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    color: colors.gray[500],
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});

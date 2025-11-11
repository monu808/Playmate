/**
 * Razorpay WebView Payment Component
 * Works in Expo Go - No native build required!
 * Processes REAL payments using Razorpay Checkout.js in WebView
 */

import React, { useRef, useState } from 'react';
import { Modal, View, StyleSheet, ActivityIndicator, Alert, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

interface RazorpayWebViewProps {
  visible: boolean;
  amount: number; // in rupees (not paise)
  currency: string;
  keyId: string;
  orderId?: string; // Razorpay order ID
  name: string;
  description: string;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
  theme: {
    color: string;
  };
  onSuccess: (response: {
    razorpay_payment_id: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
  }) => void;
  onError: (error: any) => void;
  onDismiss: () => void;
}

export const RazorpayWebView: React.FC<RazorpayWebViewProps> = ({
  visible,
  amount,
  currency,
  keyId,
  orderId,
  name,
  description,
  prefill,
  theme,
  onSuccess,
  onError,
  onDismiss,
}) => {
  const webViewRef = useRef<WebView>(null);

  console.log('🎯 RazorpayWebView rendered with:', {
    visible,
    amount,
    currency,
    keyId: keyId?.substring(0, 10) + '...',
    name,
    prefill,
  });

  // Generate HTML with Razorpay Checkout
  const generateHTML = () => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta charset="UTF-8">
  <title>Payment</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    .payment-container {
      background: white;
      border-radius: 8px;
      padding: 32px 24px;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
      margin: auto;
    }
    .merchant-name {
      font-size: 20px;
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
    }
    .description {
      font-size: 14px;
      color: #666;
      margin-bottom: 30px;
    }
    .amount {
      font-size: 42px;
      font-weight: 700;
      color: #16a34a;
      margin-bottom: 30px;
    }
    .pay-btn {
      background: #16a34a;
      color: white;
      border: none;
      padding: 14px 28px;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      transition: background 0.2s;
    }
    .pay-btn:hover {
      background: #15803d;
    }
    .pay-btn:active {
      transform: scale(0.98);
    }
    .secure-text {
      margin-top: 20px;
      font-size: 12px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="payment-container">
    <div class="merchant-name">${name}</div>
    <div class="description">${description}</div>
    <div class="amount">₹${amount.toFixed(2)}</div>
    <button class="pay-btn" id="rzp-button">Pay Now</button>
    <div class="secure-text">🔒 Secured by Razorpay</div>
  </div>

  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    function sendMessage(data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }
    var options = {
      "key": "${keyId}",
      "amount": "${amount * 100}",
      "currency": "${currency}",
      ${orderId ? `"order_id": "${orderId}",` : ''}
      "name": "${name}",
      "description": "${description}",
      "handler": function (response) {
        sendMessage({
          type: 'success',
          data: {
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature
          }
        });
      },
      "prefill": {
        "name": "${prefill.name}",
        "email": "${prefill.email}",
        "contact": "${prefill.contact}"
      },
      "theme": {
        "color": "${theme.color}"
      },
      "modal": {
        "ondismiss": function() {
          sendMessage({ type: 'dismiss' });
        }
      }
    };

    var rzp = new Razorpay(options);

    rzp.on('payment.failed', function (response) {
      sendMessage({
        type: 'error',
        data: {
          code: response.error.code,
          description: response.error.description,
          source: response.error.source,
          step: response.error.step,
          reason: response.error.reason,
          metadata: response.error.metadata
        }
      });
    });

    document.getElementById('rzp-button').onclick = function(e) {
      e.preventDefault();
      rzp.open();
    };

    // Send ready message
    window.addEventListener('load', function() {
      sendMessage({ type: 'ready' });
    });
  </script>
</body>
</html>
    `;
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('📱 WebView Message:', data);
      
      if (data.type === 'ready') {
        console.log('✅ Payment page ready');
      } else if (data.type === 'success') {
        console.log('✅ Payment success:', data.data);
        onSuccess(data.data);
      } else if (data.type === 'error') {
        console.log('❌ Payment error:', data.data);
        onError(data.data);
      } else if (data.type === 'dismiss') {
        console.log('🚫 Payment dismissed');
        onDismiss();
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  };

  const handleWebViewError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    Alert.alert('Error', 'Failed to load payment page. Please try again.');
    onDismiss();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onDismiss}
      transparent={false}
      statusBarTranslucent={false}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.container}>
          <WebView
            ref={webViewRef}
            source={{ html: generateHTML() }}
            onMessage={handleMessage}
            onLoadStart={() => {
              console.log('🔄 WebView loading started...');
            }}
            onLoadEnd={() => {
              console.log('✅ WebView loading completed');
            }}
            onError={handleWebViewError}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={false}
            style={styles.webview}
            mixedContentMode="always"
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            setSupportMultipleWindows={false}
            onShouldStartLoadWithRequest={(request) => {
              // Allow all requests to load within the WebView
              console.log('🔗 Loading URL:', request.url);
              return true;
            }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    zIndex: 999,
  },
});

// Type declarations for react-native-razorpay
declare module 'react-native-razorpay' {
  export interface RazorpayOptions {
    description: string;
    image?: string;
    currency: string;
    key: string;
    amount: number;
    name: string;
    order_id?: string;
    prefill?: {
      email?: string;
      contact?: string;
      name?: string;
    };
    theme?: {
      color?: string;
      hide_topbar?: boolean;
    };
    modal?: {
      backdropclose?: boolean;
      escape?: boolean;
      handleback?: boolean;
      confirm_close?: boolean;
      ondismiss?: () => void;
      animation?: boolean;
    };
    notes?: Record<string, string>;
    recurring?: boolean;
    subscription_id?: string;
    subscription_card_change?: boolean;
  }

  export interface RazorpaySuccessResponse {
    razorpay_payment_id: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
  }

  export interface RazorpayErrorResponse {
    code: string;
    description: string;
    source: string;
    step: string;
    reason: string;
    metadata: {
      payment_id?: string;
      order_id?: string;
    };
  }

  interface RazorpayCheckout {
    open(options: RazorpayOptions): Promise<RazorpaySuccessResponse>;
    PAYMENT_CANCELLED: string;
  }

  const RazorpayCheckout: RazorpayCheckout;
  export default RazorpayCheckout;
}

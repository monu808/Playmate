declare module 'expo-blur' {
  import * as React from 'react';
  import { ViewProps } from 'react-native';

  export interface BlurViewProps extends ViewProps {
    intensity?: number;
    tint?: 'light' | 'dark' | 'default' | string;
    experimentalBlurMethod?: string;
  }

  export const BlurView: React.ComponentType<BlurViewProps>;
}

import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { colors, typography, borderRadius, spacing, shadows } from '../../lib/theme';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  fullScreen?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  children,
  showCloseButton = true,
  fullScreen = false,
}) => {
  return (
    <RNModal
      visible={visible}
      transparent={!fullScreen}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={false}
    >
      <View style={styles.modalWrapper}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <View style={[styles.modal, fullScreen && styles.fullScreenModal]}>
            {(title || showCloseButton) && (
              <View style={styles.header}>
                {title && <Text style={styles.title}>{title}</Text>}
                {showCloseButton && (
                  <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color={colors.textPrimary} />
                  </TouchableOpacity>
                )}
              </View>
            )}
            
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  modalWrapper: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '95%',
    paddingBottom: Platform.OS === 'android' ? spacing.md : 0,
    ...shadows.xl,
  },
  fullScreenModal: {
    borderRadius: 0,
    maxHeight: '100%',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    flex: 1,
  },
  closeButton: {
    padding: spacing.xs,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
});

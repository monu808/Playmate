import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Turf } from '../../types';
import { colors, typography, spacing, borderRadius, shadows } from '../../lib/theme';
import { LoadingSpinner } from '../../components/ui';

export default function PendingTurfsScreen({ navigation }: any) {
  const [pendingTurfs, setPendingTurfs] = useState<Turf[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTurf, setSelectedTurf] = useState<Turf | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadPendingTurfs();
  }, []);

  const loadPendingTurfs = async () => {
    try {
      const q = query(
        collection(db, 'turfs'),
        where('isVerified', '==', false)
      );
      
      const snapshot = await getDocs(q);
      const turfs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          // Ensure required fields have default values
          images: data.images || [],
          amenities: data.amenities || [],
          availableSlots: data.availableSlots || [],
          ownerPhone: data.ownerPhone || '',
        };
      }) as Turf[];
      
      // Sort by creation date (newest first)
      turfs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      console.log('📋 Pending turfs loaded:', turfs.length);
      turfs.forEach(turf => {
        console.log(`  - ${turf.name} (${turf.id})`);
      });
      
      setPendingTurfs(turfs);
    } catch (error) {
      console.error('Error loading pending turfs:', error);
      Alert.alert('Error', 'Failed to load pending turfs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadPendingTurfs();
  };

  const handleApprove = async (turf: Turf) => {
    Alert.alert(
      'Approve Turf',
      `Are you sure you want to approve "${turf.name}"? This will make it visible to users.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            setProcessing(true);
            try {
              const turfRef = doc(db, 'turfs', turf.id);
              await updateDoc(turfRef, {
                isVerified: true,
                isActive: true,
                verifiedAt: Timestamp.now(),
                rejectionReason: null,
              });
              
              Alert.alert('Success', 'Turf has been approved successfully!');
              loadPendingTurfs();
            } catch (error) {
              console.error('Error approving turf:', error);
              Alert.alert('Error', 'Failed to approve turf');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = (turf: Turf) => {
    setSelectedTurf(turf);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!selectedTurf) return;
    
    if (!rejectionReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for rejection');
      return;
    }

    setProcessing(true);
    try {
      const turfRef = doc(db, 'turfs', selectedTurf.id);
      await updateDoc(turfRef, {
        isVerified: false,
        isActive: false,
        rejectionReason: rejectionReason.trim(),
      });
      
      setShowRejectModal(false);
      Alert.alert('Success', 'Turf has been rejected');
      loadPendingTurfs();
    } catch (error) {
      console.error('Error rejecting turf:', error);
      Alert.alert('Error', 'Failed to reject turf');
    } finally {
      setProcessing(false);
    }
  };

  const viewTurfDetails = (turf: Turf) => {
    navigation.navigate('TurfDetail', { id: turf.id });
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pending Verification</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pendingTurfs.length}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {pendingTurfs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={80} color={colors.gray[300]} />
            <Text style={styles.emptyTitle}>All Caught Up!</Text>
            <Text style={styles.emptyText}>No pending turfs to verify</Text>
          </View>
        ) : (
          pendingTurfs.map((turf) => (
            <View key={turf.id} style={styles.turfCard}>
              {/* Turf Image */}
              <TouchableOpacity onPress={() => viewTurfDetails(turf)}>
                <Image
                  source={{ uri: turf.images?.[0] || 'https://via.placeholder.com/400x200' }}
                  style={styles.turfImage}
                />
              </TouchableOpacity>

              {/* Turf Info */}
              <View style={styles.turfInfo}>
                <View style={styles.turfHeader}>
                  <Text style={styles.turfName}>{turf.name}</Text>
                  <View style={styles.sportBadge}>
                    <Ionicons 
                      name={turf.sport === 'football' ? 'football' : 'basketball'} 
                      size={14} 
                      color={colors.primary[600]} 
                    />
                    <Text style={styles.sportText}>{turf.sport}</Text>
                  </View>
                </View>

                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.locationText}>
                    {turf.location.address}, {turf.location.city}
                  </Text>
                </View>

                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Price:</Text>
                  <Text style={styles.price}>₹{turf.pricePerHour}/hour</Text>
                </View>

                {/* Owner Info */}
                <View style={styles.ownerInfo}>
                  <Ionicons name="person-circle-outline" size={20} color={colors.primary[600]} />
                  <View style={styles.ownerDetails}>
                    <Text style={styles.ownerName}>{turf.ownerName}</Text>
                    <Text style={styles.ownerContact}>{turf.ownerEmail}</Text>
                  </View>
                </View>

                {/* Submission Date */}
                <View style={styles.submissionDate}>
                  <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.dateText}>
                    Submitted {formatDate(turf.createdAt)}
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.viewButton]}
                    onPress={() => viewTurfDetails(turf)}
                  >
                    <Ionicons name="eye-outline" size={18} color={colors.primary[600]} />
                    <Text style={styles.viewButtonText}>View</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleReject(turf)}
                    disabled={processing}
                  >
                    <Ionicons name="close-circle-outline" size={18} color="#ffffff" />
                    <Text style={styles.rejectButtonText}>Reject</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => handleApprove(turf)}
                    disabled={processing}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                    <Text style={styles.approveButtonText}>Approve</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Reject Modal */}
      <Modal
        visible={showRejectModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reject Turf</Text>
              <TouchableOpacity onPress={() => setShowRejectModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>
              Please provide a reason for rejection:
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="e.g., Incomplete information, Poor image quality..."
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowRejectModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={confirmReject}
                disabled={processing}
              >
                {processing ? (
                  <LoadingSpinner size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Reject</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#ffffff',
    ...shadows.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginLeft: spacing.md,
  },
  badge: {
    backgroundColor: colors.primary[600],
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs - 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  turfCard: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  turfImage: {
    width: '100%',
    height: 200,
    backgroundColor: colors.gray[200],
  },
  turfInfo: {
    padding: spacing.lg,
  },
  turfHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  turfName: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  sportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs - 2,
    borderRadius: borderRadius.md,
    gap: 4,
  },
  sportText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
    textTransform: 'capitalize',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: 4,
  },
  locationText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  priceLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  price: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  ownerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  ownerDetails: {
    flex: 1,
  },
  ownerName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  ownerContact: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  submissionDate: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: 4,
  },
  dateText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.lg,
    gap: 4,
    minHeight: 44,
    ...shadows.sm,
  },
  viewButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: colors.primary[600],
  },
  viewButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  rejectButton: {
    backgroundColor: '#ef4444',
    borderWidth: 0,
  },
  rejectButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: '#ffffff',
  },
  approveButton: {
    backgroundColor: '#10b981',
    borderWidth: 0,
  },
  approveButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  modalLabel: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    minHeight: 100,
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: colors.gray[100],
  },
  modalCancelText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  modalConfirmButton: {
    backgroundColor: colors.error[600],
  },
  modalConfirmText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: '#ffffff',
  },
});

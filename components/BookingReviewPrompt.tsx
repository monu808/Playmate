import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Modal } from './ui';
import { Booking } from '../types';
import { getPendingBookingReviews, submitTurfReview } from '../lib/firebase/firestore';
import { formatTime } from '../lib/utils';

interface BookingReviewPromptProps {
  userId: string;
}

export const BookingReviewPrompt: React.FC<BookingReviewPromptProps> = ({ userId }) => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dismissedForSession, setDismissedForSession] = useState(false);
  const [pendingBooking, setPendingBooking] = useState<Booking | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const loadPendingReviewBooking = useCallback(async (openModal: boolean) => {
    if (!userId) return;

    try {
      setLoading(true);
      const pending = await getPendingBookingReviews(userId, 1);
      const nextBooking = pending[0] || null;

      setPendingBooking(nextBooking);
      if (nextBooking && openModal && !dismissedForSession) {
        setVisible(true);
      }
    } catch (error) {
      console.error('Error loading pending review booking:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, dismissedForSession]);

  useEffect(() => {
    setVisible(false);
    setPendingBooking(null);
    setRating(0);
    setComment('');
    setDismissedForSession(false);

    if (userId) {
      loadPendingReviewBooking(true);
    }
  }, [userId, loadPendingReviewBooking]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasInBackground = appStateRef.current === 'background' || appStateRef.current === 'inactive';
      if (wasInBackground && nextState === 'active') {
        loadPendingReviewBooking(true);
      }
      appStateRef.current = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, [loadPendingReviewBooking]);

  const handleClose = () => {
    setVisible(false);
    setDismissedForSession(true);
  };

  const handleSubmitReview = async () => {
    if (!pendingBooking) return;

    if (rating < 1 || rating > 5) {
      Alert.alert('Rating Required', 'Please select a rating before submitting.');
      return;
    }

    try {
      setSubmitting(true);
      const result = await submitTurfReview({
        bookingId: pendingBooking.id,
        rating,
        comment: comment.trim(),
      });

      if (!result.success) {
        Alert.alert('Unable to Submit', result.error || 'Failed to submit review.');
        return;
      }

      setVisible(false);
      setRating(0);
      setComment('');
      setPendingBooking(null);
    } catch (error) {
      console.error('Error submitting turf review:', error);
      Alert.alert('Error', 'Something went wrong while submitting your review.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!userId || loading || !pendingBooking) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      onClose={handleClose}
      title="Rate Your Match"
      showCloseButton={true}
    >
      <View style={styles.container}>
        <Text style={styles.heading}>{pendingBooking.turfName}</Text>
        <Text style={styles.subheading}>
          {format(new Date(pendingBooking.date), 'EEE, MMM dd')} • {formatTime(pendingBooking.startTime)} - {formatTime(pendingBooking.endTime)}
        </Text>

        <Text style={styles.label}>How was your experience?</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <TouchableOpacity
              key={value}
              onPress={() => setRating(value)}
              style={styles.starButton}
              disabled={submitting}
            >
              <Ionicons
                name={rating >= value ? 'star' : 'star-outline'}
                size={34}
                color={rating >= value ? '#f59e0b' : '#9ca3af'}
              />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Add a quick comment (optional)</Text>
        <TextInput
          style={styles.commentInput}
          placeholder="Share your experience"
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={4}
          value={comment}
          onChangeText={setComment}
          editable={!submitting}
        />

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.laterButton, submitting && styles.disabledButton]}
            onPress={handleClose}
            disabled={submitting}
          >
            <Text style={styles.laterButtonText}>Maybe Later</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.disabledButton]}
            onPress={handleSubmitReview}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Review</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingBottom: 8,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  subheading: {
    color: '#4b5563',
    fontSize: 13,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginTop: 6,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  starButton: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  commentInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    textAlignVertical: 'top',
    minHeight: 90,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  laterButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  laterButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#16a34a',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
});

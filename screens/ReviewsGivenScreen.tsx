import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { getMyTurfReviews } from '../lib/firebase/firestore';
import { TurfReview } from '../types';

const ReviewsGivenScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviews, setReviews] = useState<TurfReview[]>([]);

  const loadReviews = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getMyTurfReviews(user.uid);
      setReviews(data);
    } catch (error) {
      console.error('Error loading my reviews:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      loadReviews();
    }, [loadReviews])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadReviews();
  };

  const renderItem = ({ item }: { item: TurfReview }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Text style={styles.turfName}>{item.turfName}</Text>
        <Text style={styles.dateText}>{format(item.createdAt, 'dd MMM yyyy')}</Text>
      </View>

      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Ionicons
            key={`${item.id}_${value}`}
            name={item.rating >= value ? 'star' : 'star-outline'}
            size={16}
            color={item.rating >= value ? '#f59e0b' : '#9ca3af'}
          />
        ))}
      </View>

      {item.comment ? <Text style={styles.commentText}>{item.comment}</Text> : null}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={[]}>
        <ActivityIndicator size="large" color="#16a34a" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Venue Reviews Given</Text>
      </View>

      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="star-outline" size={56} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No Reviews Yet</Text>
            <Text style={styles.emptySubtitle}>
              After completed matches, reviews you submit will appear here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  listContent: {
    padding: 14,
    paddingBottom: 24,
  },
  reviewCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  turfName: {
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  dateText: {
    color: '#6b7280',
    fontSize: 12,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 8,
  },
  commentText: {
    color: '#374151',
    lineHeight: 19,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 52,
  },
  emptyTitle: {
    marginTop: 10,
    fontWeight: '700',
    fontSize: 18,
    color: '#111827',
  },
  emptySubtitle: {
    marginTop: 6,
    textAlign: 'center',
    color: '#4b5563',
    maxWidth: 280,
    lineHeight: 20,
  },
});

export default ReviewsGivenScreen;

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Modal, Card, Badge } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import {
  approvePlayerJoinRequest,
  createPlayerFinderPost,
  declinePlayerJoinRequest,
  getEligibleBookingsForPlayerFinder,
  getPendingJoinRequestsForPost,
  getPlayerFinderFeed,
  getUserJoinRequests,
  requestToJoinPlayerFinderPost,
} from '../lib/firebase/firestore';
import { formatTime } from '../lib/utils';
import { Booking, PlayerFinderJoinRequest, PlayerFinderPost } from '../types';
import { colors, spacing, typography, borderRadius } from '../lib/theme';

type JoinStatusLabel = 'none' | 'pending' | 'approved' | 'declined' | 'cancelled';

const PlayerFinderScreen: React.FC = () => {
  const { user, userData } = useAuth();
  const navigation = useNavigation<any>();

  const [posts, setPosts] = useState<PlayerFinderPost[]>([]);
  const [myRequests, setMyRequests] = useState<PlayerFinderJoinRequest[]>([]);
  const [eligibleBookings, setEligibleBookings] = useState<Booking[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingRequestPostId, setSubmittingRequestPostId] = useState<string | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [requiredPlayers, setRequiredPlayers] = useState('10');
  const [description, setDescription] = useState('');
  const [creatingPost, setCreatingPost] = useState(false);

  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PlayerFinderPost | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PlayerFinderJoinRequest[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const currentUserName =
    userData?.displayName ||
    userData?.name ||
    user?.displayName ||
    (user?.email ? user.email.split('@')[0] : 'User');

  const joinStatusByPostId = useMemo(() => {
    const statusMap: Record<string, JoinStatusLabel> = {};
    myRequests.forEach((request) => {
      statusMap[request.postId] = (request.status as JoinStatusLabel) || 'none';
    });
    return statusMap;
  }, [myRequests]);

  const loadData = useCallback(async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      const [feed, requests, bookings] = await Promise.all([
        getPlayerFinderFeed(),
        getUserJoinRequests(user.uid),
        getEligibleBookingsForPlayerFinder(user.uid),
      ]);

      setPosts(feed);
      setMyRequests(requests);
      setEligibleBookings(bookings);
    } catch (error) {
      console.error('Error loading Player Finder data:', error);
      Alert.alert('Error', 'Failed to load player finder data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openCreateModal = () => {
    if (eligibleBookings.length === 0) {
      Alert.alert(
        'No Eligible Booking',
        'You can post for players only if you have a confirmed upcoming booking without an active player finder post.'
      );
      return;
    }

    setSelectedBookingId(eligibleBookings[0].id);
    setRequiredPlayers('10');
    setDescription('');
    setCreateModalVisible(true);
  };

  const handleCreatePost = async () => {
    if (!user?.uid || !selectedBookingId) {
      Alert.alert('Missing Data', 'Please select a booking first');
      return;
    }

    const teamSize = Number(requiredPlayers);
    if (!Number.isFinite(teamSize) || teamSize < 2) {
      Alert.alert('Invalid Team Size', 'Team size must be at least 2 players');
      return;
    }

    try {
      setCreatingPost(true);

      const result = await createPlayerFinderPost(
        {
          bookingId: selectedBookingId,
          requiredPlayers: teamSize,
          description,
        },
        {
          uid: user.uid,
          name: currentUserName,
        }
      );

      if (!result.success) {
        Alert.alert('Unable to Create Post', result.error || 'Please try again');
        return;
      }

      setCreateModalVisible(false);
      await loadData();
      Alert.alert('Posted', 'Your player finder post is now live.');
    } catch (error) {
      console.error('Create post error:', error);
      Alert.alert('Error', 'Failed to create player finder post');
    } finally {
      setCreatingPost(false);
    }
  };

  const handleRequestJoin = async (post: PlayerFinderPost) => {
    if (!user?.uid) return;

    try {
      setSubmittingRequestPostId(post.id);
      const result = await requestToJoinPlayerFinderPost({
        postId: post.id,
        userId: user.uid,
        userName: currentUserName,
        userPhone: userData?.phoneNumber || user?.phoneNumber || null,
        userPhotoURL: userData?.photoURL || user?.photoURL || null,
      });

      if (!result.success) {
        Alert.alert('Unable to Send Request', result.error || 'Please try again');
        return;
      }

      await loadData();
      Alert.alert('Request Sent', 'Host will review your join request.');
    } catch (error) {
      console.error('Join request error:', error);
      Alert.alert('Error', 'Failed to send join request');
    } finally {
      setSubmittingRequestPostId(null);
    }
  };

  const openManageRequests = async (post: PlayerFinderPost) => {
    if (!user?.uid) return;

    try {
      setSelectedPost(post);
      setManageModalVisible(true);
      const pending = await getPendingJoinRequestsForPost(post.id, user.uid);
      setPendingRequests(pending);
    } catch (error) {
      console.error('Pending request load error:', error);
      Alert.alert('Error', 'Could not load join requests');
    }
  };

  const handleApprove = async (request: PlayerFinderJoinRequest) => {
    if (!user?.uid || !selectedPost) return;

    try {
      setProcessingRequestId(request.id);
      const result = await approvePlayerJoinRequest(request.id, user.uid);
      if (!result.success) {
        Alert.alert('Approval Failed', result.error || 'Unable to approve this request');
        return;
      }

      const pending = await getPendingJoinRequestsForPost(selectedPost.id, user.uid);
      setPendingRequests(pending);
      await loadData();
    } catch (error) {
      console.error('Approve request error:', error);
      Alert.alert('Error', 'Failed to approve request');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleDecline = async (request: PlayerFinderJoinRequest) => {
    if (!user?.uid || !selectedPost) return;

    try {
      setProcessingRequestId(request.id);
      const result = await declinePlayerJoinRequest(request.id, user.uid);
      if (!result.success) {
        Alert.alert('Decline Failed', result.error || 'Unable to decline this request');
        return;
      }

      setPendingRequests((prev) => prev.filter((entry) => entry.id !== request.id));
      await loadData();
    } catch (error) {
      console.error('Decline request error:', error);
      Alert.alert('Error', 'Failed to decline request');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const openTeamChat = (post: PlayerFinderPost) => {
    navigation.navigate('PlayerFinderChat', {
      postId: post.id,
      turfName: post.turfName,
    });
  };

  const getPostBadge = (post: PlayerFinderPost) => {
    if (post.status === 'full') return <Badge text="FULL" color="warning" size="small" />;
    if (post.status === 'cancelled') return <Badge text="CANCELLED" color="error" size="small" />;
    if (post.status === 'completed') return <Badge text="COMPLETED" color="secondary" size="small" />;
    return <Badge text="OPEN" color="success" size="small" />;
  };

  const renderActionButton = (post: PlayerFinderPost) => {
    const isOwnPost = post.createdBy === user?.uid;

    if (isOwnPost) {
      return (
        <View style={styles.dualActionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.manageButton, styles.halfActionButton]}
            onPress={() => openManageRequests(post)}
          >
            <Ionicons name="settings-outline" size={16} color="#166534" />
            <Text style={styles.manageButtonText}>Manage Requests</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.chatButton, styles.halfActionButton]}
            onPress={() => openTeamChat(post)}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={16} color="#1d4ed8" />
            <Text style={styles.chatButtonText}>Team Chat</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const joinStatus = joinStatusByPostId[post.id] || 'none';

    if (joinStatus === 'approved') {
      return (
        <View style={styles.dualActionRow}>
          <View style={[styles.actionButton, styles.approvedButton, styles.halfActionButton]}>
            <Ionicons name="checkmark-circle" size={16} color="#065f46" />
            <Text style={styles.approvedButtonText}>Joined</Text>
          </View>
          <TouchableOpacity
            style={[styles.actionButton, styles.chatButton, styles.halfActionButton]}
            onPress={() => openTeamChat(post)}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={16} color="#1d4ed8" />
            <Text style={styles.chatButtonText}>Team Chat</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (joinStatus === 'pending') {
      return (
        <View style={[styles.actionButton, styles.pendingButton]}>
          <Ionicons name="time-outline" size={16} color="#92400e" />
          <Text style={styles.pendingButtonText}>Request Pending</Text>
        </View>
      );
    }

    if (joinStatus === 'declined' || joinStatus === 'cancelled') {
      return (
        <View style={[styles.actionButton, styles.declinedButton]}>
          <Ionicons name="close-circle-outline" size={16} color="#b91c1c" />
          <Text style={styles.declinedButtonText}>Request Declined</Text>
        </View>
      );
    }

    const disableJoin = post.status !== 'open';

    return (
      <TouchableOpacity
        style={[
          styles.actionButton,
          disableJoin ? styles.fullButton : styles.joinButton,
          submittingRequestPostId === post.id && styles.actionButtonDisabled,
        ]}
        disabled={disableJoin || submittingRequestPostId === post.id}
        onPress={() => handleRequestJoin(post)}
      >
        {submittingRequestPostId === post.id ? (
          <ActivityIndicator size="small" color={disableJoin ? '#6b7280' : '#ffffff'} />
        ) : (
          <>
            <Ionicons
              name={disableJoin ? 'lock-closed' : 'person-add'}
              size={16}
              color={disableJoin ? '#6b7280' : '#ffffff'}
            />
            <Text style={disableJoin ? styles.fullButtonText : styles.joinButtonText}>
              {disableJoin ? 'Team Full' : 'Request to Join'}
            </Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  const renderPostCard = ({ item }: { item: PlayerFinderPost }) => {
    return (
      <Card style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={styles.postHeaderLeft}>
            <Text style={styles.turfName} numberOfLines={1}>
              {item.turfName}
            </Text>
            <Text style={styles.hostLine}>Host: {item.createdByName}</Text>
          </View>
          {getPostBadge(item)}
        </View>

        <View style={styles.row}>
          <Ionicons name="calendar-outline" size={16} color={colors.gray[500]} />
          <Text style={styles.rowText}>{format(new Date(item.date), 'EEE, MMM dd, yyyy')}</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="time-outline" size={16} color={colors.gray[500]} />
          <Text style={styles.rowText}>
            {formatTime(item.startTime)} - {formatTime(item.endTime)}
          </Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="people-outline" size={16} color={colors.gray[500]} />
          <Text style={styles.rowText}>
            {item.currentPlayers}/{item.requiredPlayers} players
          </Text>
        </View>

        {!!item.description && <Text style={styles.description}>{item.description}</Text>}

        <View style={styles.actionRow}>{renderActionButton(item)}</View>
      </Card>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Player Finder</Text>
          <Text style={styles.headerSubtitle}>Find players for your booking and join open teams</Text>
        </View>
        <TouchableOpacity style={styles.postButton} onPress={openCreateModal}>
          <Ionicons name="add" size={20} color="#ffffff" />
          <Text style={styles.postButtonText}>Post</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPostCard}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={56} color={colors.gray[300]} />
            <Text style={styles.emptyTitle}>No Teams Right Now</Text>
            <Text style={styles.emptySubtitle}>Create a post from your confirmed booking to start finding players.</Text>
          </View>
        }
      />

      <Modal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        title="Create Player Finder Post"
      >
        <Text style={styles.modalLabel}>Choose Booking</Text>
        <View style={styles.bookingPickerContainer}>
          {eligibleBookings.map((booking) => {
            const isSelected = selectedBookingId === booking.id;
            return (
              <TouchableOpacity
                key={booking.id}
                style={[styles.bookingOption, isSelected && styles.bookingOptionSelected]}
                onPress={() => setSelectedBookingId(booking.id)}
              >
                <Text style={[styles.bookingOptionTitle, isSelected && styles.bookingOptionTitleSelected]}>
                  {booking.turfName}
                </Text>
                <Text style={[styles.bookingOptionSubtitle, isSelected && styles.bookingOptionSubtitleSelected]}>
                  {format(new Date(booking.date), 'EEE, MMM dd')} • {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.modalLabel}>Team Size (including you)</Text>
        <TextInput
          style={styles.input}
          value={requiredPlayers}
          onChangeText={setRequiredPlayers}
          keyboardType="number-pad"
          placeholder="Enter team size"
          placeholderTextColor={colors.gray[400]}
        />

        <Text style={styles.modalLabel}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          placeholder="Example: Need 3 players for evening football."
          placeholderTextColor={colors.gray[400]}
        />

        <TouchableOpacity
          style={[styles.createButton, creatingPost && styles.actionButtonDisabled]}
          disabled={creatingPost}
          onPress={handleCreatePost}
        >
          {creatingPost ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.createButtonText}>Create Post</Text>
          )}
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={manageModalVisible}
        onClose={() => {
          setManageModalVisible(false);
          setSelectedPost(null);
          setPendingRequests([]);
        }}
        title="Pending Join Requests"
      >
        {pendingRequests.length === 0 ? (
          <View style={styles.noRequestContainer}>
            <Ionicons name="checkmark-done-outline" size={36} color={colors.success} />
            <Text style={styles.noRequestText}>No pending requests</Text>
          </View>
        ) : (
          pendingRequests.map((request) => {
            const busy = processingRequestId === request.id;
            return (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestInfo}>
                  <Text style={styles.requestName}>{request.requestedByName}</Text>
                  <Text style={styles.requestMeta}>Requested just now or recently</Text>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[styles.smallButton, styles.declineSmallButton]}
                    onPress={() => handleDecline(request)}
                    disabled={busy}
                  >
                    <Text style={styles.declineSmallButtonText}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.smallButton, styles.approveSmallButton]}
                    onPress={() => handleApprove(request)}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.approveSmallButtonText}>Approve</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
  },
  header: {
    backgroundColor: colors.primary[600],
    paddingTop: 50,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.92)',
    marginTop: 4,
    maxWidth: 220,
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0f7a37',
    borderRadius: borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  postButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 110,
  },
  postCard: {
    marginBottom: spacing.md,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  postHeaderLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  turfName: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: colors.gray[900],
  },
  hostLine: {
    marginTop: 2,
    color: colors.gray[500],
    fontSize: typography.fontSize.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  rowText: {
    color: colors.gray[700],
    fontSize: typography.fontSize.sm,
  },
  description: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    color: colors.gray[600],
    fontSize: typography.fontSize.sm,
  },
  actionRow: {
    marginTop: spacing.xs,
  },
  dualActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  halfActionButton: {
    flex: 1,
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  joinButton: {
    backgroundColor: colors.primary[600],
  },
  joinButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  fullButton: {
    backgroundColor: colors.gray[200],
  },
  fullButtonText: {
    color: colors.gray[600],
    fontWeight: '700',
  },
  pendingButton: {
    backgroundColor: '#fef3c7',
  },
  pendingButtonText: {
    color: '#92400e',
    fontWeight: '700',
  },
  approvedButton: {
    backgroundColor: '#d1fae5',
  },
  approvedButtonText: {
    color: '#065f46',
    fontWeight: '700',
  },
  declinedButton: {
    backgroundColor: '#fee2e2',
  },
  declinedButtonText: {
    color: '#b91c1c',
    fontWeight: '700',
  },
  manageButton: {
    backgroundColor: '#dcfce7',
  },
  manageButtonText: {
    color: '#166534',
    fontWeight: '700',
  },
  chatButton: {
    backgroundColor: '#dbeafe',
  },
  chatButtonText: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: colors.gray[800],
  },
  emptySubtitle: {
    marginTop: spacing.xs,
    textAlign: 'center',
    color: colors.gray[500],
  },
  modalLabel: {
    fontWeight: '700',
    color: colors.gray[800],
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  bookingPickerContainer: {
    gap: spacing.sm,
  },
  bookingOption: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    backgroundColor: '#ffffff',
  },
  bookingOptionSelected: {
    borderColor: colors.primary[600],
    backgroundColor: '#f0fdf4',
  },
  bookingOptionTitle: {
    color: colors.gray[900],
    fontWeight: '700',
  },
  bookingOptionTitleSelected: {
    color: colors.primary[700],
  },
  bookingOptionSubtitle: {
    marginTop: 4,
    color: colors.gray[600],
    fontSize: typography.fontSize.sm,
  },
  bookingOptionSubtitleSelected: {
    color: colors.primary[700],
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    color: colors.gray[900],
  },
  textArea: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  createButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: typography.fontSize.base,
  },
  noRequestContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  noRequestText: {
    marginTop: spacing.sm,
    color: colors.gray[600],
    fontWeight: '600',
  },
  requestCard: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: '#ffffff',
  },
  requestInfo: {
    marginBottom: spacing.sm,
  },
  requestName: {
    fontWeight: '700',
    color: colors.gray[900],
  },
  requestMeta: {
    marginTop: 2,
    color: colors.gray[500],
    fontSize: typography.fontSize.sm,
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  smallButton: {
    minWidth: 90,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  declineSmallButton: {
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  declineSmallButtonText: {
    color: '#b91c1c',
    fontWeight: '700',
    fontSize: typography.fontSize.sm,
  },
  approveSmallButton: {
    backgroundColor: colors.primary[600],
  },
  approveSmallButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: typography.fontSize.sm,
  },
});

export default PlayerFinderScreen;

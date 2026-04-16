import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import GroupsScreen from './GroupsScreen';
import PlayerFinderScreen from './PlayerFinderScreen';
import { getMyGroupInvitations, respondToGroupInvitation } from '../lib/firebase/firestore';
import { GroupInvitation } from '../types';

type SegmentKey = 'finder' | 'groups' | 'invites';

const segments: Array<{ key: SegmentKey; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'finder', label: 'Find Players', icon: 'people-outline' },
  { key: 'groups', label: 'Groups', icon: 'people-circle-outline' },
  { key: 'invites', label: 'Invites', icon: 'mail-open-outline' },
];

const PlayersHubScreen: React.FC = () => {
  const { user } = useAuth();
  const [activeSegment, setActiveSegment] = useState<SegmentKey>('finder');
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [refreshingInvites, setRefreshingInvites] = useState(false);
  const [respondingInvitationId, setRespondingInvitationId] = useState<string | null>(null);

  const loadInvitations = useCallback(
    async (showLoader: boolean) => {
      if (!user?.uid) {
        setInvitations([]);
        setLoadingInvites(false);
        setRefreshingInvites(false);
        return;
      }

      try {
        if (showLoader) {
          setLoadingInvites(true);
        }

        const pendingInvitations = await getMyGroupInvitations(user.uid);
        setInvitations(pendingInvitations);
      } catch (error) {
        console.error('Error loading group invitations:', error);
        Alert.alert('Error', 'Unable to load invitations right now.');
      } finally {
        setLoadingInvites(false);
        setRefreshingInvites(false);
      }
    },
    [user?.uid]
  );

  useFocusEffect(
    useCallback(() => {
      loadInvitations(activeSegment === 'invites');
    }, [loadInvitations, activeSegment])
  );

  const onRefreshInvites = () => {
    setRefreshingInvites(true);
    loadInvitations(false);
  };

  const handleInvitationResponse = async (
    invitation: GroupInvitation,
    action: 'accept' | 'decline'
  ) => {
    try {
      setRespondingInvitationId(invitation.id);

      const result = await respondToGroupInvitation({
        invitationId: invitation.id,
        action,
      });

      if (!result.success) {
        Alert.alert('Unable to Update Invite', result.error || 'Please try again.');
        return;
      }

      await loadInvitations(false);

      if (action === 'accept') {
        Alert.alert('Joined Group', `You are now a member of ${invitation.groupName}.`);
      }
    } catch (error) {
      console.error('Error responding to invitation:', error);
      Alert.alert('Error', 'Failed to update invitation.');
    } finally {
      setRespondingInvitationId(null);
    }
  };

  const renderInvitationCard = ({ item }: { item: GroupInvitation }) => {
    const isBusy = respondingInvitationId === item.id;

    return (
      <View style={styles.inviteCard}>
        <View style={styles.inviteBadgeRow}>
          <View style={styles.inviteBadge}>
            <Ionicons name="mail-outline" size={14} color="#0369a1" />
            <Text style={styles.inviteBadgeText}>Pending</Text>
          </View>
        </View>

        <Text style={styles.inviteTitle}>{item.groupName}</Text>
        <Text style={styles.inviteSubtitle}>Invited by {item.invitedByName}</Text>

        <View style={styles.inviteActionsRow}>
          <TouchableOpacity
            style={[styles.inviteActionButton, styles.declineButton, isBusy && styles.disabledButton]}
            onPress={() => handleInvitationResponse(item, 'decline')}
            disabled={isBusy}
          >
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.inviteActionButton, styles.acceptButton, isBusy && styles.disabledButton]}
            onPress={() => handleInvitationResponse(item, 'accept')}
            disabled={isBusy}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.acceptText}>Accept</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderInvitesTab = () => {
    if (loadingInvites) {
      return (
        <View style={styles.invitesLoadingWrap}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      );
    }

    return (
      <FlatList
        data={invitations}
        keyExtractor={(item) => item.id}
        renderItem={renderInvitationCard}
        refreshControl={<RefreshControl refreshing={refreshingInvites} onRefresh={onRefreshInvites} />}
        contentContainerStyle={
          invitations.length === 0 ? styles.invitesListContentEmpty : styles.invitesListContent
        }
        ListHeaderComponent={
          <View style={styles.inviteHeaderCard}>
            <Text style={styles.inviteHeaderTitle}>Team Invites</Text>
            <Text style={styles.inviteHeaderSubtitle}>
              Respond to incoming group invitations here.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="mail-open-outline" size={56} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No Pending Invites</Text>
            <Text style={styles.emptySubtitle}>
              Group invitations from teammates will appear here.
            </Text>
          </View>
        }
      />
    );
  };

  const renderActiveSegment = () => {
    if (activeSegment === 'finder') {
      return <PlayerFinderScreen embedded />;
    }

    if (activeSegment === 'groups') {
      return <GroupsScreen embedded showInvitations={false} />;
    }

    return renderInvitesTab();
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Players</Text>
        <Text style={styles.headerSubtitle}>
          Find teammates, manage your groups, and clear invites in one place.
        </Text>

        <View style={styles.segmentRow}>
          {segments.map((segment) => {
            const active = activeSegment === segment.key;
            const isInvites = segment.key === 'invites';

            return (
              <TouchableOpacity
                key={segment.key}
                style={[styles.segmentButton, active && styles.segmentButtonActive]}
                onPress={() => setActiveSegment(segment.key)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={segment.icon}
                  size={16}
                  color={active ? '#166534' : '#ffffff'}
                />
                <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
                  {segment.label}
                </Text>
                {isInvites && invitations.length > 0 ? (
                  <View style={[styles.segmentBadge, active && styles.segmentBadgeActive]}>
                    <Text style={[styles.segmentBadgeText, active && styles.segmentBadgeTextActive]}>
                      {invitations.length}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.content}>{renderActiveSegment()}</View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 14,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSubtitle: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
  },
  segmentRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.36)',
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  segmentButtonActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  segmentButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  segmentButtonTextActive: {
    color: '#166534',
  },
  segmentBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  segmentBadgeActive: {
    backgroundColor: '#dcfce7',
  },
  segmentBadgeText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '700',
  },
  segmentBadgeTextActive: {
    color: '#166534',
  },
  content: {
    flex: 1,
  },
  invitesLoadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invitesListContent: {
    padding: 14,
    paddingBottom: 24,
  },
  invitesListContentEmpty: {
    padding: 14,
    flexGrow: 1,
  },
  inviteHeaderCard: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 12,
    marginBottom: 12,
  },
  inviteHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  inviteHeaderSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#4b5563',
  },
  inviteCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d1fae5',
    padding: 12,
    marginBottom: 10,
  },
  inviteBadgeRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  inviteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e0f2fe',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inviteBadgeText: {
    color: '#0369a1',
    fontSize: 11,
    fontWeight: '700',
  },
  inviteTitle: {
    fontWeight: '700',
    color: '#111827',
    fontSize: 15,
  },
  inviteSubtitle: {
    marginTop: 2,
    color: '#4b5563',
    fontSize: 13,
  },
  inviteActionsRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  inviteActionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: {
    backgroundColor: '#f3f4f6',
  },
  acceptButton: {
    backgroundColor: '#16a34a',
  },
  declineText: {
    color: '#374151',
    fontWeight: '700',
  },
  acceptText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.65,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  emptySubtitle: {
    marginTop: 6,
    textAlign: 'center',
    color: '#4b5563',
    lineHeight: 20,
  },
});

export default PlayersHubScreen;

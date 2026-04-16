import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import {
  getGroupById,
  getGroupInvitationsForOwner,
  inviteGroupMember,
} from '../lib/firebase/firestore';
import { GroupInvitation, PlayerGroup, PlayerGroupMember } from '../types';

type RootStackParamList = {
  GroupDetail: { groupId: string };
};

type GroupDetailRouteProp = RouteProp<RootStackParamList, 'GroupDetail'>;

const GroupDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<GroupDetailRouteProp>();
  const { groupId } = route.params;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [group, setGroup] = useState<PlayerGroup | null>(null);
  const [ownerInvites, setOwnerInvites] = useState<GroupInvitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const isOwner = !!group && !!user && group.createdBy === user.uid;

  const loadData = useCallback(async () => {
    if (!groupId || !user?.uid) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      const groupData = await getGroupById(groupId);
      if (!groupData) {
        Alert.alert('Group Not Found', 'This group may have been deleted.');
        navigation.goBack();
        return;
      }

      setGroup(groupData);

      if (groupData.createdBy === user.uid) {
        const invites = await getGroupInvitationsForOwner(groupId, user.uid);
        setOwnerInvites(invites);
      } else {
        setOwnerInvites([]);
      }
    } catch (error) {
      console.error('Error loading group details:', error);
      Alert.alert('Error', 'Unable to load group details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId, user?.uid, navigation]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleInvite = async () => {
    if (!isOwner || !group) return;

    if (!inviteEmail.trim()) {
      Alert.alert('Email Required', 'Enter teammate email to send an invitation.');
      return;
    }

    try {
      setInviting(true);
      const result = await inviteGroupMember({
        groupId: group.id,
        inviteeEmail: inviteEmail.trim(),
      });

      if (!result.success) {
        Alert.alert('Invite Failed', result.error || 'Unable to send invitation.');
        return;
      }

      setInviteEmail('');
      await loadData();
    } catch (error) {
      console.error('Error inviting teammate:', error);
      Alert.alert('Error', 'Failed to send invitation.');
    } finally {
      setInviting(false);
    }
  };

  const renderMember = ({ item }: { item: PlayerGroupMember }) => (
    <View style={styles.memberCard}>
      <View style={styles.memberAvatar}>
        <Text style={styles.memberAvatarText}>{(item.name || 'P').charAt(0).toUpperCase()}</Text>
      </View>

      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.name}</Text>
        <Text style={styles.memberRole}>{item.role === 'owner' ? 'Group Owner' : 'Member'}</Text>
      </View>

      {item.role === 'owner' && (
        <View style={styles.ownerBadge}>
          <Text style={styles.ownerBadgeText}>OWNER</Text>
        </View>
      )}
    </View>
  );

  const renderOwnerInvite = ({ item }: { item: GroupInvitation }) => (
    <View style={styles.inviteRow}>
      <View>
        <Text style={styles.inviteEmailText}>{item.invitedUserEmail}</Text>
        <Text style={styles.inviteStatusText}>Status: {item.status}</Text>
      </View>
      <View style={[styles.inviteStatusPill, item.status === 'pending' ? styles.pendingPill : styles.respondedPill]}>
        <Text style={styles.inviteStatusPillText}>{item.status.toUpperCase()}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={[]}>
        <ActivityIndicator size="large" color="#16a34a" />
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={[]}>
        <Text style={styles.emptyText}>Group not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{group.name}</Text>
          <Text style={styles.subtitle}>{group.memberCount || group.memberIds.length} members</Text>
        </View>
      </View>

      <FlatList
        data={group.members}
        keyExtractor={(item) => item.userId}
        renderItem={renderMember}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {!!group.description && <Text style={styles.description}>{group.description}</Text>}

            {isOwner && (
              <View style={styles.ownerPanel}>
                <Text style={styles.panelTitle}>Invite Teammate</Text>
                <TextInput
                  style={styles.input}
                  placeholder="teammate@email.com"
                  placeholderTextColor="#9ca3af"
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TouchableOpacity
                  style={[styles.inviteButton, inviting && styles.disabledButton]}
                  onPress={handleInvite}
                  disabled={inviting}
                >
                  {inviting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.inviteButtonText}>Send Invite</Text>
                  )}
                </TouchableOpacity>

                <Text style={styles.panelSubtitle}>Recent Invitations</Text>
                {ownerInvites.length === 0 ? (
                  <Text style={styles.noInvitesText}>No invitations sent yet.</Text>
                ) : (
                  <FlatList
                    data={ownerInvites}
                    keyExtractor={(item) => item.id}
                    renderItem={renderOwnerInvite}
                    scrollEnabled={false}
                  />
                )}
              </View>
            )}

            <Text style={styles.sectionTitle}>Members</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No members yet.</Text>}
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  headerCenter: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    color: '#4b5563',
    marginTop: 2,
  },
  listContent: {
    padding: 14,
    paddingBottom: 24,
  },
  description: {
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  ownerPanel: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1fae5',
    padding: 12,
    marginBottom: 14,
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  panelSubtitle: {
    marginTop: 10,
    marginBottom: 6,
    fontWeight: '700',
    color: '#111827',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
  },
  inviteButton: {
    marginTop: 8,
    backgroundColor: '#16a34a',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  inviteButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  noInvitesText: {
    color: '#6b7280',
    fontSize: 12,
  },
  inviteRow: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  inviteEmailText: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 13,
  },
  inviteStatusText: {
    marginTop: 2,
    color: '#6b7280',
    fontSize: 12,
  },
  inviteStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pendingPill: {
    backgroundColor: '#fef3c7',
  },
  respondedPill: {
    backgroundColor: '#e5e7eb',
  },
  inviteStatusPillText: {
    color: '#374151',
    fontSize: 10,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  memberCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    color: '#166534',
    fontWeight: '700',
  },
  memberInfo: {
    marginLeft: 10,
    flex: 1,
  },
  memberName: {
    color: '#111827',
    fontWeight: '700',
  },
  memberRole: {
    color: '#6b7280',
    marginTop: 1,
    fontSize: 12,
  },
  ownerBadge: {
    backgroundColor: '#dcfce7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ownerBadgeText: {
    color: '#166534',
    fontSize: 10,
    fontWeight: '700',
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.65,
  },
});

export default GroupDetailScreen;

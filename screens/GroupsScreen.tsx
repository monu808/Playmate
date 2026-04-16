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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Modal } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import {
  createPlayerGroup,
  getMyGroupInvitations,
  getMyGroups,
  respondToGroupInvitation,
} from '../lib/firebase/firestore';
import { GroupInvitation, PlayerGroup } from '../types';

interface GroupsScreenProps {
  embedded?: boolean;
  showInvitations?: boolean;
}

const GroupsScreen: React.FC<GroupsScreenProps> = ({
  embedded = false,
  showInvitations = true,
}) => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groups, setGroups] = useState<PlayerGroup[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');

  const loadData = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      const [myGroups, myInvitations] = await Promise.all([
        getMyGroups(user.uid),
        getMyGroupInvitations(user.uid),
      ]);

      setGroups(myGroups);
      setInvitations(myInvitations);
    } catch (error) {
      console.error('Error loading groups data:', error);
      Alert.alert('Error', 'Unable to load groups right now.');
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

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Group Name Required', 'Please enter a group name.');
      return;
    }

    try {
      setCreatingGroup(true);
      const result = await createPlayerGroup({
        name: groupName.trim(),
        description: groupDescription.trim(),
      });

      if (!result.success) {
        Alert.alert('Unable to Create Group', result.error || 'Please try again.');
        return;
      }

      setGroupName('');
      setGroupDescription('');
      setCreateModalVisible(false);
      await loadData();
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group.');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleInvitationResponse = async (
    invitation: GroupInvitation,
    action: 'accept' | 'decline'
  ) => {
    try {
      const result = await respondToGroupInvitation({
        invitationId: invitation.id,
        action,
      });

      if (!result.success) {
        Alert.alert('Unable to Update Invite', result.error || 'Please try again.');
        return;
      }

      await loadData();
    } catch (error) {
      console.error('Error responding to invitation:', error);
      Alert.alert('Error', 'Failed to update invitation.');
    }
  };

  const renderGroupCard = ({ item }: { item: PlayerGroup }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
      activeOpacity={0.8}
    >
      <View style={styles.groupHeaderRow}>
        <View style={styles.groupIconWrap}>
          <Ionicons name="people" size={18} color="#166534" />
        </View>
        <View style={styles.groupMainInfo}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.groupMeta}>{item.memberCount || item.memberIds.length} members</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </View>
      {!!item.description && (
        <Text style={styles.groupDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderInvitationCard = ({ item }: { item: GroupInvitation }) => (
    <View style={styles.inviteCard}>
      <Text style={styles.inviteTitle}>Invitation to join {item.groupName}</Text>
      <Text style={styles.inviteSubtitle}>Invited by {item.invitedByName}</Text>

      <View style={styles.inviteActionsRow}>
        <TouchableOpacity
          style={[styles.inviteActionButton, styles.declineButton]}
          onPress={() => handleInvitationResponse(item, 'decline')}
        >
          <Text style={styles.declineText}>Decline</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.inviteActionButton, styles.acceptButton]}
          onPress={() => handleInvitationResponse(item, 'accept')}
        >
          <Text style={styles.acceptText}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={embedded ? ['left', 'right'] : []}>
        <ActivityIndicator size="large" color="#16a34a" />
      </SafeAreaView>
    );
  }

  const shouldShowListHeader = embedded || (showInvitations && invitations.length > 0);

  return (
    <SafeAreaView style={styles.container} edges={embedded ? ['left', 'right'] : []}>
      {!embedded ? (
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Groups</Text>
            <Text style={styles.headerSubtitle}>Create your circle and invite teammates</Text>
          </View>
          <TouchableOpacity style={styles.createButton} onPress={() => setCreateModalVisible(true)}>
            <Ionicons name="add" size={20} color="#ffffff" />
            <Text style={styles.createButtonText}>Create</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={renderGroupCard}
        contentContainerStyle={[styles.listContent, embedded && styles.embeddedListContent]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          shouldShowListHeader ? (
            <>
              {embedded ? (
                <View style={styles.embeddedToolbar}>
                  <View style={styles.embeddedToolbarCopy}>
                    <Text style={styles.embeddedToolbarTitle}>Groups</Text>
                    <Text style={styles.embeddedToolbarSubtitle}>
                      Build your circle and jump into matches faster.
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.embeddedCreateButton} onPress={() => setCreateModalVisible(true)}>
                    <Ionicons name="add" size={18} color="#ffffff" />
                    <Text style={styles.embeddedCreateButtonText}>Create</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {showInvitations && invitations.length > 0 ? (
                <View style={styles.invitesSection}>
                  <Text style={styles.sectionTitle}>Pending Invitations</Text>
                  <FlatList
                    data={invitations}
                    keyExtractor={(item) => item.id}
                    renderItem={renderInvitationCard}
                    scrollEnabled={false}
                  />
                </View>
              ) : null}
            </>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={56} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No Groups Yet</Text>
            <Text style={styles.emptySubtitle}>
              Create a group and invite frequent teammates for faster team setup.
            </Text>
          </View>
        }
      />

      <Modal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        title="Create Group"
      >
        <View style={styles.modalContent}>
          <Text style={styles.inputLabel}>Group Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Weekend Warriors"
            placeholderTextColor="#9ca3af"
            value={groupName}
            onChangeText={setGroupName}
            maxLength={50}
          />

          <Text style={styles.inputLabel}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.descriptionInput]}
            placeholder="Football squad for evening games"
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
            value={groupDescription}
            onChangeText={setGroupDescription}
            maxLength={240}
          />

          <TouchableOpacity
            style={[styles.submitButton, creatingGroup && styles.disabledButton]}
            onPress={handleCreateGroup}
            disabled={creatingGroup}
          >
            {creatingGroup ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Create Group</Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
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
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    marginTop: 2,
    color: '#4b5563',
    fontSize: 13,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  createButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  listContent: {
    padding: 14,
    paddingBottom: 28,
  },
  embeddedListContent: {
    paddingTop: 12,
  },
  embeddedToolbar: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  embeddedToolbarCopy: {
    flex: 1,
    marginRight: 8,
  },
  embeddedToolbarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  embeddedToolbarSubtitle: {
    marginTop: 2,
    color: '#4b5563',
    fontSize: 12,
  },
  embeddedCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  embeddedCreateButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  invitesSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  groupCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    marginBottom: 10,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  groupMainInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  groupMeta: {
    marginTop: 2,
    fontSize: 12,
    color: '#4b5563',
  },
  groupDescription: {
    marginTop: 8,
    color: '#4b5563',
    fontSize: 13,
    lineHeight: 18,
  },
  inviteCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d1fae5',
    padding: 12,
    marginBottom: 8,
  },
  inviteTitle: {
    fontWeight: '700',
    color: '#111827',
    fontSize: 14,
  },
  inviteSubtitle: {
    marginTop: 2,
    color: '#4b5563',
    fontSize: 12,
  },
  inviteActionsRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  inviteActionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
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
  emptyState: {
    alignItems: 'center',
    paddingTop: 52,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 10,
    color: '#111827',
  },
  emptySubtitle: {
    marginTop: 6,
    textAlign: 'center',
    color: '#4b5563',
    lineHeight: 20,
    maxWidth: 280,
  },
  modalContent: {
    gap: 10,
    paddingBottom: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  descriptionInput: {
    minHeight: 86,
    textAlignVertical: 'top',
  },
  submitButton: {
    marginTop: 6,
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
    opacity: 0.65,
  },
});

export default GroupsScreen;

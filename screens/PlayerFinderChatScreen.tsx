import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import {
  getPlayerFinderChatMessages,
  sendPlayerFinderChatMessage,
} from '../lib/firebase/firestore';
import { PlayerFinderChatMessage } from '../types';
import { borderRadius, colors, spacing, typography } from '../lib/theme';

type RootStackParamList = {
  PlayerFinderChat: {
    postId: string;
    turfName: string;
  };
};

type ChatRouteProp = RouteProp<RootStackParamList, 'PlayerFinderChat'>;
type ChatNavigationProp = StackNavigationProp<RootStackParamList, 'PlayerFinderChat'>;

const PlayerFinderChatScreen: React.FC = () => {
  const route = useRoute<ChatRouteProp>();
  const navigation = useNavigation<ChatNavigationProp>();
  const { postId, turfName } = route.params;

  const { user, userData } = useAuth();

  const [messages, setMessages] = useState<PlayerFinderChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const listRef = useRef<FlatList<PlayerFinderChatMessage>>(null);

  const senderName =
    userData?.displayName ||
    userData?.name ||
    user?.displayName ||
    (user?.email ? user.email.split('@')[0] : 'Player');

  const loadMessages = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getPlayerFinderChatMessages(postId, user.uid);
      setMessages(data);
    } catch (error) {
      console.error('Error loading team chat messages:', error);
      Alert.alert('Error', 'Could not load team chat messages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [postId, user?.uid]);

  useFocusEffect(
    useCallback(() => {
      loadMessages();
    }, [loadMessages])
  );

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 120);
    }
  }, [messages]);

  const onRefresh = () => {
    setRefreshing(true);
    loadMessages();
  };

  const handleSend = async () => {
    if (!user?.uid) return;

    const message = input.trim();
    if (!message) return;

    try {
      setSending(true);
      const result = await sendPlayerFinderChatMessage(postId, user.uid, senderName, message);

      if (!result.success) {
        Alert.alert('Unable to Send', result.error || 'Message could not be sent');
        return;
      }

      setInput('');
      const updatedMessages = await getPlayerFinderChatMessages(postId, user.uid);
      setMessages(updatedMessages);
    } catch (error) {
      console.error('Error sending team chat message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: PlayerFinderChatMessage }) => {
    const isMine = item.senderId === user?.uid;

    return (
      <View style={[styles.messageWrap, isMine ? styles.messageWrapMine : styles.messageWrapOther]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
          {!isMine && <Text style={styles.senderName}>{item.senderName}</Text>}
          <Text style={styles.messageText}>{item.message}</Text>
          <Text style={styles.messageTime}>{format(item.createdAt, 'hh:mm a')}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Team Chat</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {turfName}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        {loading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="small" color={colors.primary[600]} />
            <Text style={styles.stateText}>Loading messages...</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View style={styles.stateContainer}>
                <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.gray[400]} />
                <Text style={styles.stateText}>No messages yet. Start chatting with your team.</Text>
              </View>
            }
          />
        )}

        <View style={styles.composerWrap}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type your message"
            placeholderTextColor={colors.gray[400]}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, (sending || !input.trim()) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={sending || !input.trim()}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="send" size={16} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  header: {
    backgroundColor: colors.primary[600],
    paddingTop: 50,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSubtitle: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.9)',
    fontSize: typography.fontSize.sm,
  },
  chatContainer: {
    flex: 1,
  },
  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing['3xl'],
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  stateText: {
    color: colors.gray[600],
    textAlign: 'center',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  messageWrap: {
    marginBottom: spacing.sm,
  },
  messageWrapMine: {
    alignItems: 'flex-end',
  },
  messageWrapOther: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleMine: {
    backgroundColor: '#dcfce7',
  },
  bubbleOther: {
    backgroundColor: '#f3f4f6',
  },
  senderName: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[500],
    marginBottom: 2,
    fontWeight: '600',
  },
  messageText: {
    color: colors.gray[900],
    fontSize: typography.fontSize.sm,
  },
  messageTime: {
    marginTop: 4,
    color: colors.gray[500],
    fontSize: typography.fontSize.xs,
    textAlign: 'right',
  },
  composerWrap: {
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    backgroundColor: '#ffffff',
    color: colors.gray[900],
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[600],
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
});

export default PlayerFinderChatScreen;

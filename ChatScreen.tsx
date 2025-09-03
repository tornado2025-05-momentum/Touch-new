// ChatScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { GiftedChat, IMessage } from 'react-native-gifted-chat';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from './navigator/RootNavigator';
import firestore from '@react-native-firebase/firestore';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

// 既に作成済みのルームID
const roomId = 'demo-room-1';

export function ChatScreen({ navigation }: Props) {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [checking, setChecking] = useState(true);

  const roomRef = firestore().collection('rooms').doc(roomId);
  const msgCol = roomRef.collection('messages');

  // 認証状態を監視（未ログインなら Account へ誘導）
  useEffect(() => {
    const unsub = auth().onAuthStateChanged(u => {
      if (!u) {
        navigation.replace('Account');
      } else {
        setUser(u);
        setChecking(false);
      }
    });
    return unsub;
  }, [navigation]);

  // Firestore購読
  useEffect(() => {
    const unsubscribe = msgCol
      .orderBy('createdAt', 'desc')
      .limit(20)
      .onSnapshot(snapshot => {
        const allMessages: IMessage[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            _id: doc.id,
            text: data.text,
            createdAt: data.createdAt?.toDate?.() ?? new Date(),
            user: data.user,
          } as IMessage;
        });
        setMessages(allMessages);
      });

    return () => unsubscribe();
  }, []);

  // Firestoreへ送信
  const onSend = useCallback(
    async (newMessages: IMessage[] = []) => {
      if (!user) return;

      // GiftedChat に即時反映
      setMessages(prev => GiftedChat.append(prev, newMessages));

      const batch = firestore().batch();

      // ルーム本体も更新（participants, type, updatedAt）
      batch.set(
        roomRef,
        {
          participants: [user.uid].sort(),
          type: 'dm',
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // メッセージを保存
      newMessages.forEach(m => {
        const ref = msgCol.doc(m._id as string);
        batch.set(ref, {
          _id: m._id ?? ref.id,
          text: m.text,
          createdAt: firestore.FieldValue.serverTimestamp(),
          user: {
            _id: user.uid,
            name: user.isAnonymous ? '匿名' : user.email ?? 'User',
          },
        });
      });

      await batch.commit();
    },
    [user]
  );

  if (checking) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <GiftedChat
      messages={messages}
      onSend={onSend}
      user={{
        _id: user!.uid,
        name: user!.isAnonymous ? '匿名' : user!.email ?? 'User',
      }}
      showUserAvatar
      alwaysShowSend
    />
  );
}

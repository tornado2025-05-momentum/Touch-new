// ChatScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Button, TouchableOpacity, StyleSheet } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { GiftedChat, IMessage } from 'react-native-gifted-chat';

// RootNavigator の型は現状 Chat: undefined ですが、
// setParams を使うために any で受けます（テスト目的のため）
import type { RootStackParamList } from './navigator/RootNavigator';

// ===== 検証用の固定UID（フォールバック用に残す） =====
const UID1 = '33y7VZmwZrVWGhFrVW5M24igywF3';
const UID2 = '5JDGpX8AGGNp48xJfBkYtuuL6rD2';

// 2人の uid から安定したルームIDを生成（辞書順連結）
const roomIdFor = (a: string, b: string) => (a < b ? `${a}_${b}` : `${b}_${a}`);

type MessageDoc = {
  _id: string;
  text: string;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  user: { _id: string; name: string };
};

type Me = { uid: string; name: string };
type RoomHandle = {
  id: string;
  ref: FirebaseFirestoreTypes.DocumentReference<FirebaseFirestoreTypes.DocumentData>;
  msgs: FirebaseFirestoreTypes.CollectionReference<MessageDoc>;
};

// ★ 名前付きエクスポート（RootNavigator から { ChatScreen } で読み込み）
export function ChatScreen() {
  const [me, setMe] = useState<Me | null>(null);
  const [messages, setMessages] = useState<IMessage[]>([]);

  // ---- ルート／ナビ（型は any で緩めに）
  type ChatRoute = RouteProp<RootStackParamList, 'Chat'>;
  const route = useRoute<ChatRoute>();
  const navigation: any = useNavigation();

  const routePeerUid = (route.params as any)?.peerUid as string | undefined;

  // ---- テスト用パネルの状態
  const [devOpen, setDevOpen] = useState<boolean>(true); // 初期表示ON（不要なら false）
  const [peerInput, setPeerInput] = useState<string>(routePeerUid ?? '');

  // ログイン状態
  useEffect(() => {
    const unsub = auth().onAuthStateChanged(u => {
      if (!u) return setMe(null);
      setMe({ uid: u.uid, name: u.isAnonymous ? '匿名' : u.email ?? 'User' });
    });
    return unsub;
  }, []);

  // 相手UIDの決定：param を最優先、なければ固定テストペアにフォールバック
  const peerUid = useMemo(() => {
    if (!me) return null;
    if (routePeerUid) return routePeerUid;                 // ★ これが最優先
    if (me.uid === UID1) return UID2;
    if (me.uid === UID2) return UID1;
    console.warn('[WARN] peerUid 未指定＆固定ペア外:', me.uid);
    return null;
  }, [me, routePeerUid]);

  // ルーム参照
  const room = useMemo<RoomHandle | null>(() => {
    if (!me || !peerUid) return null;
    const id = roomIdFor(me.uid, peerUid);
    const ref = firestore().collection('rooms').doc(id) as RoomHandle['ref'];
    const msgs = ref.collection('messages') as RoomHandle['msgs'];
    return { id, ref, msgs };
  }, [me, peerUid]);

  // メッセージ購読
  useEffect(() => {
    if (!room) return;
    const unsub = room.msgs
      .orderBy('createdAt', 'desc')
      .limit(50)
      .onSnapshot(
        (snap) => {
          const list: IMessage[] = [];
          snap.forEach((d) => {
            const v = d.data() as MessageDoc;
            list.push({
              _id: v._id ?? d.id,
              text: v.text ?? '',
              createdAt: v.createdAt?.toDate?.() ?? new Date(),
              user: { _id: v.user?._id ?? 'unknown', name: v.user?.name ?? 'User' },
            });
          });
          setMessages(list);
        },
        (err) => {
          console.log('[onSnapshot ERR]', (err as any)?.code ?? '', err.message);
        },
      );
    return unsub;
  }, [room]);

  // 送信
  const onSend = useCallback(
    async (out: IMessage[] = []) => {
      if (!me || !room || !peerUid || out.length === 0) return;
      const m = out[0];

      const id =
        typeof m._id === 'string' ? m._id : firestore().collection('_').doc().id;

      const now: FirebaseFirestoreTypes.Timestamp = firestore.Timestamp.now();

      const roomPayload = {
        participants: { [me.uid]: true, [peerUid]: true },
        type: 'dm',
        lastMessage: m.text ?? '',
        lastMessageAt: now,
        updatedAt: now,
        createdAt: now,
      };
      await room.ref.set(roomPayload, { merge: true });

      const msgPayload: MessageDoc = {
        _id: id,
        text: m.text ?? '',
        createdAt: now,
        user: { _id: me.uid, name: me.name },
      };
      await room.msgs.doc(id).set(msgPayload);
    },
    [me, room, peerUid],
  );

  // ---- テスト用：peerUid を手動で注入
  const applyPeer = (value: string) => {
    if (!value) return;
    setPeerInput(value);
    navigation.setParams({ peerUid: value }); // ★ ここでルートparamを書き換え
  };

  return (
    <View style={{ flex: 1 }}>
      {/* === テスト用パネル（本番前に消せばOK） === */}
      <View style={styles.devWrap}>
        <TouchableOpacity onPress={() => setDevOpen(o => !o)}>
          <Text style={styles.devTitle}>
            {devOpen ? '▼' : '▶'} DEV: 手動で peerUid を指定（画面内テスト用）
          </Text>
        </TouchableOpacity>

        {devOpen && (
          <View style={styles.devBody}>
            <Text style={styles.line}>me: {me?.uid ?? '(未ログイン)'}</Text>
            <Text style={styles.line}>current peerUid(param): {routePeerUid ?? '(未指定)'} </Text>

            <View style={styles.row}>
              <TextInput
                value={peerInput}
                onChangeText={setPeerInput}
                placeholder="相手の UID を入力"
                style={styles.input}
                autoCapitalize="none"
              />
              <Button title="適用" onPress={() => applyPeer(peerInput.trim())} />
            </View>

            <View style={styles.row}>
              <Button title="UID1 を相手に" onPress={() => applyPeer(UID1)} />
              <View style={{ width: 8 }} />
              <Button title="UID2 を相手に" onPress={() => applyPeer(UID2)} />
              <View style={{ width: 8 }} />
              <Button title="param クリア" onPress={() => navigation.setParams({ peerUid: undefined })} />
            </View>

            <Text style={styles.hint}>
              ※ setParams で画面の param を更新 → その値が最優先で使われます
            </Text>
          </View>
        )}
      </View>

      {/* === チャット本体 === */}
      <GiftedChat
        messages={messages}
        onSend={msgs => onSend(msgs)}
        user={{ _id: me?.uid ?? 'unknown', name: me?.name ?? 'User' }}
        placeholder="Type a message..."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  devWrap: { padding: 10, backgroundColor: '#f2f2f2', borderBottomWidth: 1, borderBottomColor: '#ddd' },
  devTitle: { fontWeight: 'bold', marginBottom: 6 },
  devBody: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 6, paddingHorizontal: 8, height: 36 },
  line: { fontSize: 12, color: '#333' },
  hint: { fontSize: 12, color: '#666' },
});

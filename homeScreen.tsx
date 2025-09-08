import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

type Props = any; // Tab/Stack 両方から使えるよう汎用化

type EncounterDoc = {
  peerUid: string;
  roomId: string;
  place?: string | null;
  date: string; // YYYY-MM-DD
  timestamp?: any;
};

type PeerProfile = {
  uid: string;
  name?: string;
  affiliation?: string;
  avatarUrl?: string;
  content?: Array<{
    id: string;
    type: 'image' | 'text';
    uri?: string;
    text?: string;
  }>;
};

function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function HomeScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [encounters, setEncounters] = useState<EncounterDoc[]>([]);
  const [peers, setPeers] = useState<Record<string, PeerProfile>>({});

  const uid = auth().currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    const col = firestore()
      .collection('users')
      .doc(uid)
      .collection('encounters');
    const q = col.where('date', '==', todayKey());
    const unsub = q.onSnapshot(async snap => {
      const items = snap.docs.map(d => ({
        ...(d.data() as any),
      })) as EncounterDoc[];
      setEncounters(items);
      // fetch peers minimal profiles
      const uids = Array.from(new Set(items.map(i => i.peerUid))).filter(
        Boolean,
      );
      if (uids.length === 0) {
        setPeers({});
        setLoading(false);
        return;
      }
      const reads = await Promise.all(
        uids.map(async id => {
          try {
            const ds = await firestore().collection('users').doc(id).get();
            const data =
              (ds.data?.() as any) ||
              (ds as any).data?.() ||
              (ds as any).data ||
              {};
            return { id, data } as { id: string; data: any };
          } catch (_) {
            return { id, data: {} };
          }
        }),
      );
      const next: Record<string, PeerProfile> = {};
      for (const r of reads) {
        const d: any = r.data || {};
        next[r.id] = {
          uid: r.id,
          name: d.name ?? 'Unknown',
          affiliation: d.affiliation ?? '',
          avatarUrl: d.avatarUrl,
          content: Array.isArray(d.content) ? d.content : [],
        };
      }
      setPeers(next);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  const feed = useMemo(() => {
    // 1ユーザーにつき1件、画像系コンテンツを優先
    return encounters
      .map(e => peers[e.peerUid])
      .filter(Boolean)
      .map(p => {
        const c =
          (p!.content || []).find(x => x.type === 'image') || p!.content?.[0];
        return { peer: p!, content: c };
      });
  }, [encounters, peers]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>今日出会った人たち</Text>
        {/* 簡易の開閉アイコン代替 */}
        <Text style={styles.headerCaret}>⌄</Text>
      </View>

      {/* Avatars */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ paddingHorizontal: 12 }}
      >
        {encounters.map((e, idx) => {
          const p = peers[e.peerUid];
          return (
            <TouchableOpacity
              key={`${e.peerUid}_${idx}`}
              onPress={() =>
                navigation.navigate('Profile', { viewUid: e.peerUid })
              }
              style={{ marginRight: 8 }}
            >
              <Image
                source={{ uri: p?.avatarUrl || 'https://placehold.co/40x40' }}
                style={styles.avatar}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Feed cards */}
      <View style={{ paddingHorizontal: 12, marginTop: 8 }}>
        {feed.map(({ peer, content }) => (
          <TouchableOpacity
            key={peer.uid}
            style={styles.card}
            onPress={() =>
              navigation.navigate('Profile', { viewUid: peer.uid })
            }
          >
            <Image
              source={{
                uri: (content as any)?.uri || 'https://placehold.co/390x420',
              }}
              style={styles.cardImage}
            />
            <View style={styles.cardOverlay}>
              <Text style={styles.overlayName}>{peer.name}</Text>
              <Text style={styles.overlaySub}>{peer.affiliation || ''}</Text>
            </View>
          </TouchableOpacity>
        ))}
        {!loading && feed.length === 0 && (
          <View style={{ padding: 16 }}>
            <Text style={{ color: '#666' }}>
              今日はまだ誰とも出会っていません。
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#103459',
    marginRight: 8,
  },
  headerCaret: { fontSize: 18, color: '#153C65' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEE',
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F2F4F7',
    marginTop: 12,
  },
  cardImage: { width: '100%', height: 420, backgroundColor: '#DDD' },
  cardOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  overlayName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  overlaySub: { color: '#fff', fontSize: 12, marginTop: 2 },
});

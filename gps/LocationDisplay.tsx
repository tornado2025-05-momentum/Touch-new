import React from 'react';
import {
  SafeAreaView,
  Text,
  StyleSheet,
  Button,
  View,
  FlatList,
} from 'react-native';

// --- このコンポーネントが必要とするデータや関数の型を定義 ---
type Pos = { lat: number; lon: number };
type Member = {
  id: string;
  lat?: number;
  lon?: number;
  updatedAt?: any;
  place?: string;
};

interface Props {
  title: string;
  uid: string | null;
  isTracking: boolean;
  pos: Pos | null;
  place: string | null;
  error: string | null;
  members: Member[];
  onGetOnce: () => void;
  onStartTracking: () => void;
  onStopTracking: () => void;
}
// -----------------------------------------------------------

export default function LocationDisplay({
  title,
  uid,
  isTracking,
  pos,
  place,
  error,
  members,
  onGetOnce,
  onStartTracking,
  onStopTracking,
}: Props) {
  // ★ UIのJSX部分は、以前のファイルからそのままコピー
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text>UID: {uid ?? '-'}</Text>

      <View style={styles.row}>
        <Button title="現在地を1回取得 & 送信" onPress={onGetOnce} />
      </View>
      <View style={styles.row}>
        {!isTracking ? (
          <Button title="連続取得を開始" onPress={onStartTracking} />
        ) : (
          <Button title="連続取得を停止" onPress={onStopTracking} />
        )}
      </View>

      {pos && (
        <Text style={styles.pos}>
          My Lat: {pos.lat.toFixed(6)}
          {'\n'}
          My Lon: {pos.lon.toFixed(6)}
          {'\n'}
          現在地: {place ?? '取得中…'}
        </Text>
      )}
      {error && <Text style={styles.err}>Error: {error}</Text>}

      <Text style={styles.subtitle}>同じ部屋のメンバー</Text>
      <FlatList
        style={{ width: '100%', marginTop: 8 }}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        data={members}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const isMe = uid && item.id === uid;
          const timeStr = item.updatedAt?.toDate?.()
            ? item.updatedAt.toDate().toLocaleTimeString()
            : '-';
          return (
            <View style={styles.memberRow}>
              <View style={styles.memberTop}>
                <Text style={[styles.memberId, isMe && styles.me]}>
                  {isMe ? '自分' : `${item.id.slice(0, 6)}…`}
                </Text>
                <Text style={styles.memberTime}>{timeStr}</Text>
              </View>
              <Text style={styles.memberPlace}>
                すれ違い場所: {item.place ?? '取得中…'}
              </Text>
              <Text style={styles.memberCoords}>
                lat:{typeof item.lat === 'number' ? item.lat.toFixed(5) : '-'}
                {'   '}
                lon:{typeof item.lon === 'number' ? item.lon.toFixed(5) : '-'}
              </Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

// ★ スタイルもこちらに移動
const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  row: { marginVertical: 6, width: 260 },
  pos: { marginTop: 12, textAlign: 'center', fontSize: 16 },
  memberRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
  },
  memberTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  memberId: { fontSize: 14, fontWeight: '600' },
  me: { color: '#0A84FF' },
  memberTime: { fontSize: 12, color: '#888' },
  memberPlace: { marginTop: 2, fontSize: 13, color: '#444' },
  memberCoords: { marginTop: 2, fontSize: 12, color: '#666' },
  err: { marginTop: 12, color: 'red' },
});
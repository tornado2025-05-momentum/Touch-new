
// App.tsx
import React, {useEffect, useState, useRef} from 'react';
import {
  SafeAreaView,
  Text,
  StyleSheet,
  Button,
  PermissionsAndroid,
  Platform,
  View,
  FlatList,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

type Pos = { lat: number; lon: number };
type Member = { id: string; lat?: number; lon?: number; updatedAt?: any; place?: string };

const ROOM_ID = 'demo-room-1'; // 全端末で同じにする

export default function App() {
  const [granted, setGranted] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const placeCache = useRef(new Map<string, string>());
const lastReverseAt = useRef(0);
const lastCellKey = useRef<string | null>(null);



  // 起動時：未ログインなら匿名で
  useEffect(() => {
    const unsub = auth().onAuthStateChanged(async (u) => {
      if (!u) {
        try { await auth().signInAnonymously(); }
        catch (e) { console.log('anon sign-in error', e); }
      }
      setUid(u?.uid ?? null);
    });
    return unsub;
  }, []);

  // 権限リクエスト（Android）
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        const res = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);
        const ok =
          res[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED ||
          res[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
        setGranted(ok);
      } else {
        setGranted(true);
      }
    })();
  }, []);

  // Firestore 購読（同じ部屋の全メンバー）
  useEffect(() => {
    const unsub = firestore()
      .collection('rooms').doc(ROOM_ID).collection('members')
      .orderBy('updatedAt', 'desc')
      .onSnapshot(
        (snap) => {
          const arr = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Member[];
          setMembers(arr);
          console.log('members', arr);
        },
        (e) => setError(`listen: ${e.message}`),
      );
    return unsub;
  }, []);
//   useEffect(() => {
//   const ref = firestore().collection('rooms').doc(ROOM_ID).collection('members');
//   const unsub = ref.onSnapshot((snap) => {
//     const list: Member[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
//     setMembers(list);
//   });
//   return unsub;
// }, []);

  // Firestore 送信
  async function uploadLocation(lat: number, lon: number) {
    const cur = auth().currentUser?.uid;
    if (!cur) return;
    await firestore()
      .collection('rooms').doc(ROOM_ID).collection('members').doc(cur)
      .set(
        { lat, lon, updatedAt: firestore.FieldValue.serverTimestamp() },
        { merge: true },
      );
    console.log('upload', { lat, lon });
  }
  // 約100mグリッドでキャッシュキー
const cellKey = (lat: number, lon: number) => `${lat.toFixed(3)},${lon.toFixed(3)}`;

  // 逆ジオコーディング（Nominatim）
async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const key = cellKey(lat, lon);
  const cached = placeCache.current.get(key);
  if (cached) return cached;

  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${lat}&lon=${lon}&accept-language=ja&email=you@example.com`;
  const res = await fetch(url);
  const j = await res.json();
  const a = j.address || {};
  const name =
    a.neighbourhood || a.suburb || a.village || a.town || a.city ||
    a.city_district || a.municipality || a.county || '位置不明';
  placeCache.current.set(key, name);
  return name;
}

  async function updatePlace(lat: number, lon: number) {
  const now = Date.now();
  const key = cellKey(lat, lon);
  if (key === lastCellKey.current) return;         // 同じ100mマスならスキップ
  if (now - lastReverseAt.current < 3000) return;  // 3秒に1回まで
  lastReverseAt.current = now;
  lastCellKey.current = key;

  try {
    const name = await reverseGeocode(lat, lon);
    setPlace(name);

    const cur = auth().currentUser?.uid;
    if (cur) {
      await firestore()
        .collection('rooms').doc(ROOM_ID).collection('members').doc(cur)
        .set({ place: name }, { merge: true });
    }
  } catch (e) {
    // 失敗時は無視
  }
}

  // 1回取得
  const getOnce = () => {
    setError(null);
    Geolocation.getCurrentPosition(
      (p) => {
        const lat = p.coords.latitude;
        const lon = p.coords.longitude;
        setPos({ lat, lon });
        uploadLocation(lat, lon);
        updatePlace(lat, lon);
      },
      (e) => setError(`${e.code}: ${e.message}`),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0, forceRequestLocation: true, showLocationDialog: true },
    );
  };

  // 連続取得
  const startWatch = () => {
    if (watchId != null) return;
    const id = Geolocation.watchPosition(
      (p) => {
        const lat = p.coords.latitude;
        const lon = p.coords.longitude;
        setPos({ lat, lon });
        uploadLocation(lat, lon);
        updatePlace(lat, lon);
      },
      (e) => setError(`${e.code}: ${e.message}`),
      { enableHighAccuracy: true, distanceFilter: 5, interval: 3000, fastestInterval: 1000 },
    );
    setWatchId(id as unknown as number);
  };

  const stopWatch = () => {
    if (watchId != null) {
      Geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  };
  const ensureAuth = async () => {
  try {
    setAuthErr(null);
    const current = auth().currentUser;
    if (current) { setUid(current.uid); return; }
    const cred = await auth().signInAnonymously();
    setUid(cred.user.uid);
    console.log('signed in anon', cred.user.uid);
  } catch (e: any) {
    console.log('anon sign-in error', e);
    setAuthErr(`${e.code || 'auth'}: ${e.message || String(e)}`);
  }
};

// 起動時にも一度だけ試す
useEffect(() => { ensureAuth(); }, []);

  // 表示
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>位置情報 x Firebase</Text>
      <Text>UID: {uid ?? '-'}</Text>
      {authErr && <Text style={{color:'red'}}>Auth Error: {authErr}</Text>}
      <View style={styles.row}>
        <Button title="認証を再試行" onPress={ensureAuth} />
      </View>
      <Text>権限: {granted ? '許可' : '未許可'}</Text>

      <View style={styles.row}>
        <Button title="現在地を1回取得 & 送信" onPress={getOnce} />
      </View>
      <View style={styles.row}>
        {watchId == null ? (
          <Button title="連続取得を開始" onPress={startWatch} />
        ) : (
          <Button title="連続取得を停止" onPress={stopWatch} />
        )}
      </View>

      {pos && (
    <Text style={styles.pos}>
      My Lat: {pos.lat.toFixed(6)}{'\n'}
      My Lon: {pos.lon.toFixed(6)}{'\n'}
      現在地: {place ?? '取得中…'}
    </Text>
  )}
      {error && <Text style={styles.err}>Error: {error}</Text>}

      <Text style={styles.subtitle}>同じ部屋のメンバー</Text>
      <FlatList
  style={{ width: '90%', marginTop: 8 }}
  data={members}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => (
    <Text style={styles.member}>
      {item.id.slice(0, 6)}…{'  '}
      lat:{typeof item.lat === 'number' ? item.lat.toFixed(5) : '-'}{'  '}
      lon:{typeof item.lon === 'number' ? item.lon.toFixed(5) : '-'}{'  '}
      {item.place ? `(${item.place})` : ''}
      {item.updatedAt?.toDate?.() && `  (${item.updatedAt.toDate().toLocaleTimeString()})`}
      {uid && item.id === uid ? '  ← 自分' : ''}
    </Text>
  )}
/>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  row: { marginVertical: 6, width: 260 },
  pos: { marginTop: 12, textAlign: 'center', fontSize: 16 },
  member: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  err: { marginTop: 12, color: 'red' },
});



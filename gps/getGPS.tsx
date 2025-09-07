// App.tsx
import React, { useEffect, useState, useRef } from 'react';
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/RootNavigator';
import { recordEncounter } from '../firebase/firebase_system';

type Props = NativeStackScreenProps<RootStackParamList, 'GPS'>;

type Pos = { lat: number; lon: number };
type Member = {
  id: string;
  lat?: number;
  lon?: number;
  updatedAt?: any;
  place?: string;
};

const ROOM_ID = 'demo-room-1'; // 全端末で同じにする
const WALK_MAX_MPS = 1.6;

export default function getMyLocation({ route, navigation }: Props) {
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
  const nearSinceRef = useRef<Map<string, number>>(new Map());
  const lastUploadAt = useRef(0);
  const [roomMembers, setRoomMembers] = useState<Member[]>([]);
  // 同一セッションで記録済みの peer/day を避けるためのローカル記録
  const loggedTodayRef = useRef<Set<string>>(new Set());
  const lastUploadSampleRef = useRef<{
    lat: number;
    lon: number;
    t: number;
  } | null>(null);
  const mySlowRef = useRef<boolean>(false);
  const [mySpeedMps, setMySpeedMps] = useState<number | null>(null);

  // 起動時：未ログインなら匿名で
  useEffect(() => {
    const unsub = auth().onAuthStateChanged(async u => {
      if (!u) {
        try {
          await auth().signInAnonymously();
        } catch (e) {
          console.log('anon sign-in error', e);
        }
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
          res[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
            PermissionsAndroid.RESULTS.GRANTED ||
          res[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
            PermissionsAndroid.RESULTS.GRANTED;
        setGranted(ok);
      } else {
        setGranted(true);
      }
    })();
  }, []);

  // Firestore 購読（同じ部屋の全メンバー）
  useEffect(() => {
    const unsub = firestore()
      .collection('rooms')
      .doc(ROOM_ID)
      .collection('members')
      .orderBy('updatedAt', 'desc')
      .onSnapshot(
        snap => {
          const arr = snap.docs.map(d => ({
            id: d.id,
            ...(d.data() as any),
          })) as Member[];
          setMembers(arr);
          console.log('members', arr);
        },
        e => setError(`listen: ${e.message}`),
      );
    return unsub;
  }, []);
  // 近接判定（自分が徒歩以下のときだけカウント）
  useEffect(() => {
    if (!pos) return;
    const now = Date.now();
    const nearSince = nearSinceRef.current;

    members.forEach(m => {
      if (!m || m.id === uid) return;
      const hasCoords = typeof m.lat === 'number' && typeof m.lon === 'number';
      const updatedAtMs = m.updatedAt?.toDate?.()?.getTime?.() ?? 0;

      if (!hasCoords || now - updatedAtMs > 2 * 60 * 1000) {
        nearSince.delete(m.id);
        return;
      }

      const d = distanceMeters(pos.lat, pos.lon, m.lat!, m.lon!);

      // 自分が徒歩以下 かつ 100m以内のときだけ継続カウント
      if (d <= 100 && mySlowRef.current) {
        if (!nearSince.has(m.id)) nearSince.set(m.id, now);
      } else {
        nearSince.delete(m.id);
      }
    });

    const eligible = members.filter(m => {
      if (m.id === uid) return false;
      const since = nearSince.get(m.id);
      return since != null && now - since >= 10 * 60 * 1000; // 10分
    });
    setRoomMembers(eligible);
    // 遭遇確定者を記録（当日同一peerは一度だけ）
    const today = new Date();
    const y = today.getFullYear();
    const m = `${today.getMonth() + 1}`.padStart(2, '0');
    const d = `${today.getDate()}`.padStart(2, '0');
    const dayKey = `${y}-${m}-${d}`;
    const placeName = members.find(m => m.id === uid)?.place ?? null;
    eligible.forEach(e => {
      const key = `${dayKey}_${e.id}`;
      if (!loggedTodayRef.current.has(key)) {
        loggedTodayRef.current.add(key);
        recordEncounter(e.id, ROOM_ID, placeName).catch(err =>
          console.warn('recordEncounter failed:', err?.message || err),
        );
      }
    });
  }, [pos, members, uid]);

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
      .collection('rooms')
      .doc(ROOM_ID)
      .collection('members')
      .doc(cur)
      .set(
        { lat, lon, updatedAt: firestore.FieldValue.serverTimestamp() },
        { merge: true },
      );
    console.log('upload', { lat, lon });
  }
  function distanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // 約100mグリッドでキャッシュキー
  const cellKey = (lat: number, lon: number) =>
    `${lat.toFixed(3)},${lon.toFixed(3)}`;

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
      a.neighbourhood ||
      a.suburb ||
      a.village ||
      a.town ||
      a.city ||
      a.city_district ||
      a.municipality ||
      a.county ||
      '位置不明';
    placeCache.current.set(key, name);
    return name;
  }

  async function updatePlace(lat: number, lon: number) {
    const now = Date.now();
    const key = cellKey(lat, lon);
    if (key === lastCellKey.current) return; // 同じ100mマスならスキップ
    if (now - lastReverseAt.current < 3000) return; // 3秒に1回まで
    lastReverseAt.current = now;
    lastCellKey.current = key;

    try {
      const name = await reverseGeocode(lat, lon);
      setPlace(name);

      const cur = auth().currentUser?.uid;
      if (cur) {
        await firestore()
          .collection('rooms')
          .doc(ROOM_ID)
          .collection('members')
          .doc(cur)
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
      p => {
        const lat = p.coords.latitude;
        const lon = p.coords.longitude;
        setPos({ lat, lon });
        uploadLocation(lat, lon);
        updatePlace(lat, lon);
      },
      e => setError(`${e.code}: ${e.message}`),
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
        forceRequestLocation: true,
        showLocationDialog: true,
      },
    );
  };

  // 連続取得
  const startWatch = () => {
    if (watchId != null) return;
    const id = Geolocation.watchPosition(
      p => {
        const lat = p.coords.latitude;
        const lon = p.coords.longitude;
        setPos({ lat, lon });

        const now = Date.now();
        // 1分間隔で送信（このタイミングで過去1分の平均速度を計算）
        if (now - lastUploadAt.current >= 60 * 1000) {
          // 速度[m/s] = 前回送信地点との距離 / 経過秒
          let speedMps: number | null = null;
          const prev = lastUploadSampleRef.current;
          if (prev) {
            const dt = (now - prev.t) / 1000;
            if (dt > 0) {
              const d = distanceMeters(lat, lon, prev.lat, prev.lon);
              speedMps = d / dt;
            }
          }
          // 歩行以下判定を更新（初回は prev なし → 判定不可 → false）
          mySlowRef.current = speedMps != null && speedMps <= WALK_MAX_MPS;
          setMySpeedMps(speedMps);

          lastUploadAt.current = now;
          lastUploadSampleRef.current = { lat, lon, t: now };

          uploadLocation(lat, lon);
          updatePlace(lat, lon);
        }
      },
      e => setError(`${e.code}: ${e.message}`),
      {
        enableHighAccuracy: true,
        distanceFilter: 0, // 距離に関係なく通知
        interval: 60000, // 1分毎（Android目安）
        fastestInterval: 30000, // 30秒以上
      },
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
      if (current) {
        setUid(current.uid);
        return;
      }
      const cred = await auth().signInAnonymously();
      setUid(cred.user.uid);
      console.log('signed in anon', cred.user.uid);
    } catch (e: any) {
      console.log('anon sign-in error', e);
      setAuthErr(`${e.code || 'auth'}: ${e.message || String(e)}`);
    }
  };

  // 起動時にも一度だけ試す
  useEffect(() => {
    ensureAuth();
  }, []);

  // 表示
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>位置情報 x Firebase</Text>
      <Text>UID: {uid ?? '-'}</Text>
      {authErr && <Text style={{ color: 'red' }}>Auth Error: {authErr}</Text>}
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
          My Lat: {pos.lat.toFixed(6)}
          {'\n'}
          My Lon: {pos.lon.toFixed(6)}
          {'\n'}
          現在地: {place ?? '取得中…'}
        </Text>
      )}

      {mySpeedMps != null && (
        <Text style={styles.caption}>
          自分の推定速度: {(mySpeedMps * 3.6).toFixed(1)} km/h（
          {mySlowRef.current ? '徒歩以下' : '速い'}）
        </Text>
      )}
      {error && <Text style={styles.err}>Error: {error}</Text>}

      <Text style={styles.subtitle}>
        同じ部屋のメンバー（10分以上・半径100m以内）
      </Text>
      <FlatList
        style={{ width: '100%', marginTop: 8 }}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        data={roomMembers}
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
                {'  '}
                lon:{typeof item.lon === 'number' ? item.lon.toFixed(5) : '-'}
              </Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  caption: { fontSize: 12, color: '#666', marginTop: 4 },
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

  member: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  err: { marginTop: 12, color: 'red' },
});

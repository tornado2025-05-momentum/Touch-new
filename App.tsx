import React, {useEffect, useState} from 'react';
import {
  SafeAreaView,
  Text,
  StyleSheet,
  Button,
  PermissionsAndroid,
  Platform,
  View,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
// 追加: Firebase/Firestore + geofire
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { geohashForLocation, geohashQueryBounds, distanceBetween } from 'geofire-common';

type Pos = {lat: number; lon: number};
// 追加: 近傍候補の型
type Candidate = { uid: string; lat: number; lon: number; geohash: string };

export default function App() {
  const [granted, setGranted] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
    // 追加: Firebase の匿名ユーザーIDとログ
  const [uid, setUid] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const seenPairs = React.useRef<Set<string>>(new Set());
  const lastUploadAt = React.useRef<number>(0);

  const log = (s: string) => setLogs((ls) => [s, ...ls].slice(0, 20));


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
    // 追加: 匿名ログイン（なぜ: ルールで保護しつつユーザー識別するため）
    useEffect(() => {
      auth()
        .signInAnonymously()
        .then((cred) => {
          setUid(cred.user.uid);
          log(`Signed in as ${cred.user.uid}`);
        })
        .catch((e) => {
          setError(`auth error: ${e.message}`);
        });
    }, []);
// 追加: 自分のプロフィール（デモ。必要に応じて入力UIに）
  const myProfile = { account: 'anon', message: 'よろしく！' };

  // 追加: 自分の位置を Firestore にアップサート
  const upsertMyLocation = async (lat: number, lon: number) => {
    if (!uid) return;
    const gh = geohashForLocation([lat, lon]);
    await firestore().collection('users').doc(uid).set(
      {
        account: myProfile.account,
        message: myProfile.message,
        lastPos: { lat, lon, geohash: gh, updatedAt: firestore.FieldValue.serverTimestamp() },
      },
      { merge: true }
    );
  };

// 追加: 20m以内のユーザーを検索（geohashで候補→実距離で絞る）
  const findNearbyWithin20m = async (lat: number, lon: number): Promise<Candidate[]> => {
    const center: [number, number] = [lat, lon];
    const radiusInM = 20;
    const bounds = geohashQueryBounds(center, radiusInM);
    const col = firestore().collection('users');

    const found: Candidate[] = [];
    for (const b of bounds) {
      const snap = await col
        .orderBy('lastPos.geohash')
        .startAt(b[0])
        .endAt(b[1])
        .get();

      snap.forEach((doc) => {
        if (doc.id === uid) return;
        const data: any = doc.data();
        const p = data?.lastPos;
        if (!p?.lat || !p?.lon) return;
        const distInKm = distanceBetween([lat, lon], [p.lat, p.lon]);
        if (distInKm * 1000 <= radiusInM) {
          found.push({ uid: doc.id, lat: p.lat, lon: p.lon, geohash: p.geohash });
        }
      });
    }
    return found;
  };

  // 追加: 交換ドキュメントを作成（重複防止）
  const createExchangeIfNotExists = async (otherUid: string) => {
    if (!uid) return;
    const [a, b] = [uid, otherUid].sort();
    const pairId = `${a}_${b}`;
    if (seenPairs.current.has(pairId)) return;

    const ref = firestore().collection('exchanges').doc(pairId);
    const docSnap = await ref.get();
    if (!docSnap.exists) {
      await ref.set({
        pairId,
        aUid: a,
        bUid: b,
        // 自分のスナップショットだけ即保存（相手側も自身の端末で保存する想定）
        aSnapshot: a === uid ? myProfile : null,
        bSnapshot: b === uid ? myProfile : null,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      log(`交換作成: ${pairId}`);
    }
    seenPairs.current.add(pairId);
  };

  // 追加: 位置アップロード→近傍検索→交換
  const handleProximityFlow = async (lat: number, lon: number) => {
    if (!uid) return;
    const now = Date.now();
    if (now - lastUploadAt.current > 2500) {
      await upsertMyLocation(lat, lon);
      lastUploadAt.current = now;
    }
    const nearby = await findNearbyWithin20m(lat, lon);
    for (const c of nearby) {
      await createExchangeIfNotExists(c.uid);
    }
    if (nearby.length > 0) log(`20m以内: ${nearby.length}人`);
  };

const getOnce = () => {
    setError(null);
    Geolocation.getCurrentPosition(
      (p: Geolocation.GeoPosition) => {
        const cur = {lat: p.coords.latitude, lon: p.coords.longitude};
        setPos(cur);
        handleProximityFlow(cur.lat, cur.lon).catch((e) => setError(e.message)); // ← 追加
      },
      (e: Geolocation.GeoError) => setError(e.message),
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 0},
    );
  };

  const startWatch = () => {
    if (watchId != null) return;
    const id = Geolocation.watchPosition(
      (p: Geolocation.GeoPosition) => {
        const cur = {lat: p.coords.latitude, lon: p.coords.longitude};
        setPos(cur);
        handleProximityFlow(cur.lat, cur.lon).catch((e) => setError(e.message)); // ← 追加
      },
      (e: Geolocation.GeoError) => setError(e.message),
      {enableHighAccuracy: true, distanceFilter: 5, interval: 5000, fastestInterval: 2000},
    );
    setWatchId(id as unknown as number);
  };

  const stopWatch = () => {
    if (watchId != null) {
      Geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>位置情報デモ</Text>
      <Text>権限: {granted ? '許可' : '未許可'}</Text>

      <View style={styles.row}>
        <Button title="現在地を1回取得" onPress={getOnce} />
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
          Lat: {pos.lat.toFixed(6)}{'\n'}
          Lon: {pos.lon.toFixed(6)}
        </Text>
      )}
      {error && <Text style={styles.err}>Error: {error}</Text>}
      {/* 追加: 簡易ログ */}
      {logs.slice(0, 6).map((l, i) => (
        <Text key={i} style={{ fontSize: 12, color: '#666' }}>
          {l}
        </Text>
      ))}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16},
  title: {fontSize: 22, fontWeight: '600', marginBottom: 12},
  row: {marginVertical: 6, width: 220},
  pos: {marginTop: 16, textAlign: 'center', fontSize: 16},
  err: {marginTop: 16, color: 'red'},
});
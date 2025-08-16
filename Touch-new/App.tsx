import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Button, PermissionsAndroid, Platform, Alert } from 'react-native';
import Geolocation, { GeoPosition } from 'react-native-geolocation-service';
import BackgroundActions from 'react-native-background-actions';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

type LatLng = { lat: number; lon: number; t: number };
const RADIUS_M = 20;           // 20m
const WINDOW_MS = 10 * 60 * 1000; // 10分

// --- 距離（メートル）
const toRad = (v: number) => (v * Math.PI) / 180;
const distanceM = (a: LatLng, b: LatLng) => {
  const R = 6371000; // m
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// 10分間20m以内か？
const stayedWithin = (points: LatLng[]) => {
  if (points.length < 2) return false; // データ不足なら「不明扱い→false」
  let maxD = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = distanceM(points[i], points[j]);
      if (d > maxD) maxD = d;
      if (maxD > RADIUS_M) return false;
    }
  }
  // 全相互距離 ≤ 20m
  // かつウィンドウカバー時間 ≥ 10分
  const span = points[points.length - 1].t - points[0].t;
  return span >= WINDOW_MS;
};

const requestFine = async () => {
  if (Platform.OS !== 'android') return true;
  const res = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    { title: '位置情報', message: 'GPSで現在地を取得します', buttonPositive: 'OK' }
  );
  return res === PermissionsAndroid.RESULTS.GRANTED;
};

const requestBackground = async () => {
  if (Platform.OS !== 'android') return true;
  // Android 10+ で必要。ユーザー体験的には「設定画面から常に許可」に誘導するのが確実。
  const can = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
    { title: 'バックグラウンド位置情報', message: 'アプリ非起動時も位置情報を更新します', buttonPositive: 'OK' }
  );
  return can === PermissionsAndroid.RESULTS.GRANTED;
};

const App = () => {
  const [uid, setUid] = useState<string>();
  const [status, setStatus] = useState<'idle'|'running'>('idle');
  const historyRef = useRef<LatLng[]>([]);
  const watchIdRef = useRef<number | null>(null);

  // Firebase 匿名ログイン
  useEffect(() => {
    (async () => {
      const cred = await auth().signInAnonymously();
      setUid(cred.user.uid);
    })().catch(err => Alert.alert('Auth error', String(err)));
  }, []);

  // --- Firestore 書き込み
  const pushToFirestore = async (p: LatLng, stationary20m: boolean) => {
    if (!uid) return;
    await firestore().collection('locations').doc(uid).set(
      {
        lat: p.lat,
        lon: p.lon,
        updatedAt: p.t,
        stationary20m,           // 10分20m内かの判定結果
      },
      { merge: true }
    );
  };

  // --- 位置を履歴に追加＆ウィンドウ整形
  const addPoint = (p: LatLng) => {
    const now = Date.now();
    const arr = historyRef.current.filter(x => now - x.t <= WINDOW_MS);
    arr.push(p);
    historyRef.current = arr;
    return stayedWithin(arr);
  };

  // --- バックグラウンドタスク（通知テキストは端末に常駐表示）
  const bgTask = async (taskData: any) => {
    await new Promise<void>((resolve) => {
      // 監視開始
      watchIdRef.current = Geolocation.watchPosition(
        async (pos: GeoPosition) => {
          const p: LatLng = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            t: Date.now(),
          };
          const stationary = addPoint(p);
          await pushToFirestore(p, stationary);
        },
        (err) => {
          console.log('watch error', err);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 5,     // 5m移動で更新
          interval: 5000,        // 5秒目安
          fastestInterval: 2000,
          showsBackgroundLocationIndicator: false,
          useSignificantChanges: false,
        }
      );
    });
  };

  const options = {
    taskName: '位置追跡',
    taskTitle: '位置情報を取得中',
    taskDesc: 'GPSで位置情報を送信しています',
    taskIcon: { name: 'ic_launcher', type: 'mipmap' as const },
    parameters: {},
    // Android 10+：location を宣言（Manifestの service と整合）
    color: undefined,
    linkingURI: undefined,
  };

  const startBackground = async () => {
    if (!uid) { Alert.alert('準備中', 'ログインが完了していません'); return; }
    const fine = await requestFine();
    if (!fine) return;
    const bg = await requestBackground(); // 必要な場合のみ
    if (!bg) {
      Alert.alert('権限', '設定から「常に許可」をオンにしてください');
      return;
    }
    if (status === 'running') return;
    historyRef.current = [];
    await BackgroundActions.start(bgTask, options);
    setStatus('running');
  };

  const stopBackground = async () => {
    if (watchIdRef.current != null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    await BackgroundActions.stop();
    setStatus('idle');
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>バックグラウンドGPS × Firebase</Text>
      <Button title="バックグラウンド追跡開始" onPress={startBackground} />
      <Button title="停止" onPress={stopBackground} />
      <Text>状態: {status}</Text>
      <Text>判定: {stayedWithin(historyRef.current) ? '10分20m以内' : '未達/外れ'}</Text>
    </View>
  );
};

export default App;

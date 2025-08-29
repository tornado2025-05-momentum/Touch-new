import React, { useEffect, useState, useRef } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/RootNavigator';
import LocationDisplay from './LocationDisplay';

// --- ライブラリをこちらに差し替え ---
import Geolocation from 'react-native-geolocation-service';
import BackgroundService from 'react-native-background-actions';

// --- 型定義 (変更なし) ---
type Props = NativeStackScreenProps<RootStackParamList, 'Background'>;
type Pos = { lat: number; lon: number };
type Member = {
  id: string;
  lat?: number;
  lon?: number;
  updatedAt?: any;
  place?: string;
};

// --- 定数 (変更なし) ---
const ROOM_ID = 'demo-room-1';

// --- バックグラウンドタスク用の設定 ---
const sleep = (time: number) => new Promise<void>((resolve) => setTimeout(() => resolve(), time));

// --- コンポーネント本体 ---
export default function LocationTracker({ route, navigation }: Props) {
  // --- StateとRefの定義 (変更なし) ---
  const [isTracking, setIsTracking] = useState(BackgroundService.isRunning());
  const [pos, setPos] = useState<Pos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [place, setPlace] = useState<string | null>(null);
  const placeCache = useRef(new Map<string, string>());
  const lastReverseAt = useRef(0);
  const lastCellKey = useRef<string | null>(null);

  // --- 副作用フック (初期化処理) ---
  useEffect(() => {
    // 匿名認証 (変更なし)
    const unsubAuth = auth().onAuthStateChanged(async u => {
      if (!u) {
        try {
          await auth().signInAnonymously();
        } catch (e) {
          console.error('Anonymous sign-in error', e);
        }
      }
      setUid(u?.uid ?? null);
    });

    // Firestoreのデータ購読 (変更なし)
    const unsubFirestore = firestore()
      .collection('rooms')
      .doc(ROOM_ID)
      .collection('members')
      .orderBy('updatedAt', 'desc')
      .onSnapshot(
        snap => {
          const arr = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Member[];
          setMembers(arr);
        },
        e => setError(`Firestore listen error: ${e.message}`),
      );
      
    //クリーンアップ処理
    return () => {
      unsubAuth();
      unsubFirestore();
    };
  }, []);

  // --- ロジック関数 ---
  // (uploadLocation, reverseGeocode, updatePlaceなどは変更なしと仮定)
  const uploadLocation = async (lat: number, lon: number) => {
    if (!uid) return;
    try {
      await firestore()
        .collection('rooms')
        .doc(ROOM_ID)
        .collection('members')
        .doc(uid)
        .set({
          lat,
          lon,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    } catch (e) {
      console.error("uploadLocation error:", e);
    }
  };
  /**
   * Androidの位置情報パーミッションを要求する関数
   */
  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: '位置情報へのアクセス許可',
          message: 'このアプリはあなたの現在位置を利用します。',
          buttonPositive: '許可する',
          buttonNegative: 'キャンセル',
        },
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        setError('位置情報の利用が許可されませんでした。');
        return false;
      }
      if (Platform.Version >= 29) {
        const backgroundGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
          {
            title: 'バックグラウンドでの位置情報利用の許可',
            message: 'アプリが閉じているときも位置情報を共有するために、位置情報へのアクセスを「常に許可」に設定してください。',
            buttonPositive: '許可する',
            buttonNegative: 'キャンセル',
          },
        );
        if (backgroundGranted !== PermissionsAndroid.RESULTS.GRANTED) {
          setError('バックグラウンドでの位置情報の利用が許可されませんでした。');
          return false;
        }
      }
      return true;
    } catch (err) {
      console.warn(err);
      setError('パーミッションの要求中にエラーが発生しました。');
      return false;
    }
  };

  // ↓↓↓↓↓↓ この位置に backgroundTask の定義を追加しました ↓↓↓↓↓↓
  /**
   * バックグラウンドで実行されるタスクの本体
   */
  const backgroundTask = async (taskDataArguments?: { delay: number }) => {
    const { delay } = taskDataArguments || { delay: 10000 };
    
    for (let i = 0; BackgroundService.isRunning(); i++) {
      try {
        Geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            console.log('[BackgroundTask] 位置情報を取得:', position.coords);
            setPos({ lat: latitude, lon: longitude });
            uploadLocation(latitude, longitude);
            updatePlace(latitude, longitude);
          },
          (error) => {
            console.error('[BackgroundTask] Geolocation error:', error);
            setError(`位置情報の取得に失敗: ${error.message}`);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
      } catch (e) {
        console.error('[BackgroundTask] Error:', e);
      }
      await sleep(delay);
    }
  };
  // ↑↑↑↑↑↑ ここまでが追加されたコードです ↑↑↑↑↑↑

  // 1回取得
  const getOnce = async () => {
    setError(null);
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return;

    Geolocation.getCurrentPosition(
        (position) => {
            console.log('[getOnce]', position);
            const { latitude, longitude } = position.coords;
            setPos({ lat: latitude, lon: longitude });
            uploadLocation(latitude, longitude);
            updatePlace(latitude, longitude);
        },
        (error) => {
            setError(`GetOnce Error: ${error.message}`);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };
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
  // 連続取得を開始
  const startTracking = async () => {
    setError(null);
    if (BackgroundService.isRunning()) {
      return;
    }
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return;

    try {
      await BackgroundService.start(backgroundTask, {
        taskName: 'LocationTracking',
        taskTitle: '位置情報を記録中',
        taskDesc: 'バックグラウンドで位置情報を利用しています',
        taskIcon: {
            name: 'ic_launcher',
            type: 'mipmap',
        },
        parameters: {
            delay: 10000, // 10秒ごと
        },
      });
      setIsTracking(true);
      console.log('Background service started');
    } catch (e) {
      console.error('Cannot start background service', e);
      setError('追跡の開始に失敗しました');
    }
  };
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
  // 連続取得を停止
  const stopTracking = async () => {
    setError(null);
    try {
      await BackgroundService.stop();
      setIsTracking(false);
      console.log('Background service stopped');
    } catch (e) {
      console.error('Cannot stop background service', e);
    }
  };

  // --- レンダリング (変更なし) ---
  return (
    <LocationDisplay
      title="位置情報トラッカー (無料版)"
      uid={uid}
      isTracking={isTracking}
      pos={pos}
      place={place}
      error={error}
      members={members}
      onGetOnce={getOnce}
      onStartTracking={startTracking}
      onStopTracking={stopTracking}
    />
  );
}
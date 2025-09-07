// Background.tsx
import React, { useEffect, useState, useRef } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/RootNavigator';
import LocationDisplay from './LocationDisplay';

// 位置情報/BG 実行ライブラリ
import Geolocation from 'react-native-geolocation-service';
import BackgroundService from 'react-native-background-actions';

// ---------- 型定義 ----------
type Props = NativeStackScreenProps<RootStackParamList, 'Background'>;

type Pos = { lat: number; lon: number };

type Member = {
  id: string;
  lat?: number;
  lon?: number;
  updatedAt?: any;
  place?: string;
};

type NominatimAddress = {
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city?: string;
  city_district?: string;
  municipality?: string;
  county?: string;
};
type NominatimResponse = { address?: NominatimAddress };

// ---------- 定数 ----------
const ROOM_ID = 'demo-room-1';
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---------- コンポーネント ----------
export default function LocationTracker({
  route: _route,
  navigation: _navigation,
}: Props) {
  // State/Ref
  const [isTracking, setIsTracking] = useState(BackgroundService.isRunning());
  const [pos, setPos] = useState<Pos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [place, setPlace] = useState<string | null>(null);

  const placeCache = useRef(new Map<string, string>());
  const lastReverseAt = useRef(0);
  const lastCellKey = useRef<string | null>(null);

  // ---------- 初期化（Auth/Firestore購読） ----------
  useEffect(() => {
    const unsubAuth = auth().onAuthStateChanged(async (u) => {
      if (!u) {
        try {
          await auth().signInAnonymously();
        } catch (e) {
          console.error('Anonymous sign-in error', e);
        }
      }
      setUid(u?.uid ?? null);
    });

    const unsubFirestore = firestore()
      .collection('rooms')
      .doc(ROOM_ID)
      .collection('members')
      .orderBy('updatedAt', 'desc')
      .onSnapshot(
        (snap) => {
          const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Member[];
          setMembers(arr);
        },
        (e) => setError(`Firestore listen error: ${e.message}`),
      );

    return () => {
      unsubAuth();
      unsubFirestore();
    };
  }, []);

  // ---------- Firestore へ現在地保存 ----------
  const uploadLocation = async (lat: number, lon: number) => {
    if (!uid) return;
    try {
      await firestore()
        .collection('rooms')
        .doc(ROOM_ID)
        .collection('members')
        .doc(uid)
        .set(
          {
            lat,
            lon,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
    } catch (e) {
      console.error('uploadLocation error:', e);
    }
  };

  // ---------- 位置情報パーミッション ----------
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

      const sdkInt = Platform.Version as number; // Androidは number
      if (sdkInt >= 29) {
        const bgGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
          {
            title: 'バックグラウンドでの位置情報利用の許可',
            message:
              'アプリが閉じているときも位置情報を共有するために、位置情報へのアクセスを「常に許可」に設定してください。',
            buttonPositive: '許可する',
            buttonNegative: 'キャンセル',
          },
        );
        if (bgGranted !== PermissionsAndroid.RESULTS.GRANTED) {
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

  // ---------- 逆ジオ（Nominatim・型付け済） ----------
  const cellKey = (lat: number, lon: number) => `${lat.toFixed(3)},${lon.toFixed(3)}`;

  async function reverseGeocode(lat: number, lon: number): Promise<string> {
    const key = cellKey(lat, lon);
    const cached = placeCache.current.get(key);
    if (cached) return cached;

    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
      `&lat=${lat}&lon=${lon}&accept-language=ja&email=you@example.com`;

    try {
      const res = await fetch(url);
      const j = (await res.json()) as NominatimResponse; // ★ 型アサーションで unknown を解消
      const a = j.address ?? {};
      const name =
        a.neighbourhood ??
        a.suburb ??
        a.village ??
        a.town ??
        a.city ??
        a.city_district ??
        a.municipality ??
        a.county ??
        '位置不明';

      placeCache.current.set(key, name);
      return name;
    } catch (e) {
      console.warn('reverseGeocode error:', e);
      return '位置不明';
    }
  }

  async function updatePlace(lat: number, lon: number) {
    const now = Date.now();
    const key = cellKey(lat, lon);

    // 100m単位で変化がない/呼び過ぎ対策
    if (key === lastCellKey.current) return;
    if (now - lastReverseAt.current < 3000) return;
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
    } catch {
      // 無視（UIは最後の成功値を保持）
    }
  }

  // ---------- 単発取得 ----------
  const getOnce = async () => {
    setError(null);
    const ok = await requestLocationPermission();
    if (!ok) return;

    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setPos({ lat: latitude, lon: longitude });
        uploadLocation(latitude, longitude);
        updatePlace(latitude, longitude);
      },
      (e) => setError(`GetOnce Error: ${e.message}`),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  };

  // ---------- BGタスク本体 ----------
  const backgroundTask = async (taskData?: { delay: number }) => {
    const { delay } = taskData || { delay: 10000 };

    while (BackgroundService.isRunning()) {
      try {
        Geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setPos({ lat: latitude, lon: longitude });
            uploadLocation(latitude, longitude);
            updatePlace(latitude, longitude);
          },
          (e) => setError(`位置情報の取得に失敗: ${e.message}`),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
        );
      } catch (e) {
        console.error('[BackgroundTask] Error:', e);
      }
      await sleep(delay);
    }
  };

  // ---------- 連続取得の開始/停止 ----------
  const startTracking = async () => {
    setError(null);
    if (BackgroundService.isRunning()) return;

    const ok = await requestLocationPermission();
    if (!ok) return;

    try {
      await BackgroundService.start(
        backgroundTask,
        {
          taskName: 'LocationTracking',
          taskTitle: '位置情報を記録中',
          taskDesc: 'バックグラウンドで位置情報を利用しています',
          taskIcon: { name: 'ic_launcher', type: 'mipmap' },
          parameters: { delay: 10000 },
        } as any, // 型定義が曖昧な環境向けに最小限のキャスト
      );
      setIsTracking(true);
      console.log('Background service started');
    } catch (e) {
      console.error('Cannot start background service', e);
      setError('追跡の開始に失敗しました');
    }
  };

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

  // ---------- 表示 ----------
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

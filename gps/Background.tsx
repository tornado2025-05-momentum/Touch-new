import React, { useEffect, useState, useRef } from 'react';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import Location, { Location as LocationObject } from 'react-native-location';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/RootNavigator'; // パスを確認してください
import LocationDisplay from './LocationDisplay'; // パスを確認してください

// --- 型定義 ---
type Props = NativeStackScreenProps<RootStackParamList, 'Background'>; // 'Background'はNavigatorで設定した名前に合わせる
type Pos = { lat: number; lon: number };
type Member = {
  id: string;
  lat?: number;
  lon?: number;
  updatedAt?: any;
  place?: string;
};

// --- 定数 ---
const ROOM_ID = 'demo-room-1';

// --- コンポーネント本体 ---
export default function Background({ route, navigation }: Props) {
  // --- StateとRefの定義 ---
  const [isTracking, setIsTracking] = useState(false);
  const locationUnsubscribe = useRef<(() => void) | null>(null);
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
    // 匿名認証
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

    // 位置情報ライブラリの設定
    Location.configure({
      distanceFilter: 5, // 5m以上移動したら更新
      interval: 10000,   // 10秒間隔で更新
    });

    // コンポーネントが不要になった際のクリーンアップ処理
    return () => {
      unsubAuth();
      if (locationUnsubscribe.current) {
        locationUnsubscribe.current();
      }
    };
  }, []);

  // Firestoreのデータ購読
  useEffect(() => {
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
    return () => unsubFirestore();
  }, []);

  // --- ロジック関数 ---

  // フォアグラウンド権限のリクエスト (1回取得用)
  const requestForegroundPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: '位置情報の利用許可',
          message: '現在地の取得のために位置情報の利用を許可してください。',
          buttonPositive: 'OK',
        },
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) return true;
      Alert.alert('権限エラー', '位置情報の利用が許可されませんでした。');
      return false;
    } catch (err) {
      console.warn(err);
      return false;
    }
  };
  
  // バックグラウンド権限のリクエスト (連続取得用)
  const requestBackgroundPermission = async (): Promise<boolean> => {
      if (Platform.OS !== 'android') return true;
      const foregroundGranted = await requestForegroundPermission();
      if (!foregroundGranted) return false;

      if (Platform.Version >= 29) { // Android 10以上のみ
          const backgroundGranted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
              {
                  title: 'バックグラウンドでの位置情報の利用許可',
                  message: 'アプリがバックグラウンドにある場合でも位置情報を記録するために、「常に許可」を選択してください。',
                  buttonPositive: 'OK',
              },
          );
          if (backgroundGranted === PermissionsAndroid.RESULTS.GRANTED) return true;
          Alert.alert('権限エラー', 'バックグラウンドでの位置情報利用が許可されませんでした。');
          return false;
      }
      return true;
  };

  const uploadLocation = async (lat: number, lon: number) => { /* ... (以前の回答のコード) ... */ };
  const updatePlace = async (lat: number, lon: number) => { /* ... (以前の回答のコード) ... */ };
  
  // 1回取得
  const getOnce = async () => {
    setError(null);
    const hasPermission = await requestForegroundPermission();
    if (!hasPermission) return;

    try {
      const latestLocation = await Location.getLatestLocation({ timeout: 10000 });
      if (latestLocation) {
        const { latitude, longitude } = latestLocation;
        setPos({ lat: latitude, lon: longitude });
        await uploadLocation(latitude, longitude);
        await updatePlace(latitude, longitude);
      }
    } catch (e: any) {
      setError(`GetOnce Error: ${e.code || ''}: ${e.message}`);
    }
  };

  // 連続取得を開始
  const startTracking = async () => {
    setError(null);
    const hasPermission = await requestBackgroundPermission();
    if (!hasPermission) return;

    if (locationUnsubscribe.current) {
      locationUnsubscribe.current();
    }
    
    locationUnsubscribe.current = Location.subscribeToLocationUpdates(
      (locations: LocationObject[]) => {
        if (locations.length > 0) {
          const { latitude, longitude } = locations[0];
          setPos({ lat: latitude, lon: longitude });
          uploadLocation(latitude, longitude);
          updatePlace(latitude, longitude);
        }
      },
    );
    setIsTracking(true);
  };

  // 連続取得を停止
  const stopTracking = () => {
    if (locationUnsubscribe.current) {
      locationUnsubscribe.current();
      locationUnsubscribe.current = null;
    }
    setIsTracking(false);
  };
  
  // --- レンダリング ---
  return (
    <LocationDisplay
      title="位置情報 (バックグラウンド対応版)"
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
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
import LocationDisplay from './LocationDisplay';

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

export default function GetMyLocation({ route, navigation }: Props) {
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
      a.railway ||          // 駅名
      a.amenity ||          // 公共施設名 (レストランなど)
      a.shop ||             // 店名
      a.tourism ||          // 観光地名
      a.building ||         // 建物名
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
    if (key === lastCellKey.current) return; // 以前の位置から100m以内であれば、cellKey が同じになり、地名取得処理がスキップされる
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
        setPos({ lat, lon }); //画面に反映
        uploadLocation(lat, lon); //Firebaseへ送信
        updatePlace(lat, lon);
      },
      e => setError(`${e.code}: ${e.message}`),
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
        //forceRequestLocation: true,
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
        uploadLocation(lat, lon);
        updatePlace(lat, lon);
      },
      e => setError(`${e.code}: ${e.message}`),
      {
        enableHighAccuracy: true,
        distanceFilter: 5,  //5m以上で更新（節電）
        interval: 3000,
        fastestInterval: 1000,
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

  // UIコンポーネントに渡すために、追跡中かどうかを判定する
  const isTracking = watchId != null;

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

  //表示
  return (
    <LocationDisplay
      title="位置情報 (フォアグラウンドのみ版)"
      uid={uid}
      isTracking={isTracking}
      pos={pos}
      place={place}
      error={error}
      members={members}
      onGetOnce={getOnce}
      onStartTracking={startWatch} // startWatchを渡す
      onStopTracking={stopWatch}   // stopWatchを渡す
    />
  );
}

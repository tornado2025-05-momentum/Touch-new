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
  TextInput,
  Image,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { launchImageLibrary } from 'react-native-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/RootNavigator';
import {
  useRoomMembers,
  updateMyLocation,
  setMyPlace,
  useAuthUid,
  setMyText,
  uploadMyImage,
  getUserImageUrl,
  getFirebaseEnv,
} from '../firebase/sendRes';

type Props = NativeStackScreenProps<RootStackParamList, 'Trade'>;

type Pos = { lat: number; lon: number };

const ROOM_ID = 'demo-room-1'; // 全端末で同じにする

// 運用用の連絡先メールアドレス（Nominatim API要件）
const CONTACT_EMAIL = 'your-contact@email.com';

import type { Member } from '../firebase/sendRes'; // 型を共有

export default function getMyLocation({ route, navigation }: Props) {
  const [granted, setGranted] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [myText, setMyTextState] = useState<string>('');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [myImageUrl, setMyImageUrl] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string | null>>({});
  const placeCache = useRef(new Map<string, string>());
  const lastReverseAt = useRef(0);
  const lastCellKey = useRef<string | null>(null);
  const { uid, authErr, reauth } = useAuthUid();
  const { members, error: listenErr } = useRoomMembers(ROOM_ID);
  useEffect(() => {
    if (listenErr) setError(listenErr);
  }, [listenErr]);

  // 自分の画像URLを初期取得 & UID変化時リロード
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!uid) {
        setMyImageUrl(null);
        return;
      }
      const url = await getUserImageUrl(uid).catch(() => null);
      if (mounted) setMyImageUrl(url);
    })();
    return () => {
      mounted = false;
    };
  }, [uid]);

  // メンバー一覧から未取得の画像URLを取得してキャッシュ
  useEffect(() => {
    const ids = members.map(m => m.id).filter(Boolean);
    const need = ids.filter(id => !(id in imageUrls));
    if (need.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const id of need) {
        try {
          const url = await getUserImageUrl(id);
          if (!cancelled) setImageUrls(prev => ({ ...prev, [id]: url }));
        } catch {
          if (!cancelled) setImageUrls(prev => ({ ...prev, [id]: null }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [members, imageUrls]);

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
      `&lat=${lat}&lon=${lon}&accept-language=ja&email=${CONTACT_EMAIL}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Touch-new/1.0 (you@example.com)',
        'Accept-Language': 'ja',
      },
    });
    if (!res.ok) {
      throw new Error(
        `Reverse geocode failed: ${res.status} ${res.statusText}`,
      );
    }
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

    // 1) 逆ジオコーディング
    let name: string | null = null;
    try {
      name = await reverseGeocode(lat, lon);
      setPlace(name);
    } catch (e) {
      console.error('Reverse geocoding failed:', e);
      setError(
        `逆ジオコーディング失敗: ${e instanceof Error ? e.message : String(e)}`,
      );
      return; // ここで終了（書き込みは行わない）
    }

    // 2) Firestore への place 書き込み（失敗しても致命的ではない）
    try {
      if (name) {
        await setMyPlace(name, ROOM_ID);
        // 成功時のみセルキーを確定（失敗時は次回同セルで再試行）
        lastCellKey.current = key;
      }
    } catch (e: any) {
      console.warn('setMyPlace failed:', e);
      // permission-denied などは画面に分かりやすく表示
      const msg = e?.message || String(e);
      const code = e?.code || '';
      if (
        code === 'firestore/permission-denied' ||
        msg.includes('permission')
      ) {
        setError(
          'Firestore への書き込み権限がありません（place は端末内のみ更新）',
        );
      } else {
        setError(`場所の保存に失敗: ${msg}`);
      }
      // セルキーは確定しない（次回リトライする）
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
        updateMyLocation(lat, lon, ROOM_ID, myText?.trim() || undefined);
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
        updateMyLocation(lat, lon, ROOM_ID, myText?.trim() || undefined);
        updatePlace(lat, lon);
      },
      e => setError(`${e.code}: ${e.message}`),
      {
        enableHighAccuracy: true,
        distanceFilter: 5,
        interval: 3000,
        fastestInterval: 1000,
      },
    );
    setWatchId(id as unknown as number);
  };

  const stopWatch = () => {
    if (watchId != null) {
      Geolocation.clearWatch(watchId as number);
      setWatchId(null);
    }
  };

  // 画像選択
  const pickImage = async () => {
    const res = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
    });
    if (res.didCancel) return;
    const asset = res.assets && res.assets[0];
    if (asset?.uri) setLocalImageUri(asset.uri);
  };

  // 画像送信（Storageアップロード）
  const sendImage = async () => {
    if (!localImageUri) {
      setError('画像が選択されていません');
      return;
    }
    try {
      setError(null);
      // デバッグ: 現在のFirebase環境とアップロード先ログ
      const env = getFirebaseEnv();
      console.log('[upload] env', env);
      const { downloadURL } = await uploadMyImage(localImageUri);
      setMyImageUrl(downloadURL);
      if (uid) setImageUrls(prev => ({ ...prev, [uid]: downloadURL }));
    } catch (e: any) {
      setError(`画像アップロード失敗: ${e?.message || String(e)}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>位置情報 x Firebase</Text>
      <Text>UID: {uid ?? '-'}</Text>
      {authErr && <Text style={{ color: 'red' }}>Auth Error: {authErr}</Text>}
      <View style={styles.row}>
        <Button title="認証を再試行" onPress={reauth} />
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

      {/* 画像選択/送信 */}
      <View style={[styles.row, { width: '90%' }]}>
        <Button title="画像を選択" onPress={pickImage} />
        <View style={{ height: 8 }} />
        <Button title="画像を送信" onPress={sendImage} />
        {localImageUri ? (
          <Text style={styles.caption}>
            選択中: {localImageUri.split('/').pop()}
          </Text>
        ) : (
          <Text style={styles.caption}>画像未選択</Text>
        )}
      </View>

      {/* テキスト入力 */}
      <View style={[styles.row, { width: '90%' }]}>
        <TextInput
          value={myText}
          onChangeText={setMyTextState}
          placeholder="交換用メッセージ（例: よろしくお願いします）"
          style={styles.input}
          maxLength={200}
        />
        <View style={{ marginTop: 8 }}>
          <Button
            title="テキストだけ送信"
            onPress={() => setMyText(myText.trim())}
          />
        </View>
      </View>

      {pos && (
        <Text style={styles.pos}>
          My Lat: {pos.lat.toFixed(6)}
          {'\n'}
          My Lon: {pos.lon.toFixed(6)}
          {'\n'}
          現在地: {place ?? members.find(m => m.id === uid)?.place ?? '取得中…'}
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
          const url = isMe
            ? myImageUrl ?? imageUrls[item.id]
            : imageUrls[item.id];
          return (
            <View style={styles.memberRow}>
              <View style={styles.memberTop}>
                <Text style={[styles.memberId, isMe && styles.me]}>
                  {isMe ? '自分' : `${item.id.slice(0, 6)}…`}
                </Text>
                <Text style={styles.memberTime}>{timeStr}</Text>
              </View>
              <View style={styles.memberBodyRow}>
                <View style={styles.thumbnailWrapper}>
                  {url ? (
                    <Image
                      source={{ uri: url }}
                      style={styles.thumbnailImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.thumbnailWrapper,
                        { alignItems: 'center', justifyContent: 'center' },
                      ]}
                    >
                      <Text style={styles.caption}>No image</Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.memberPlace}>
                    すれ違い場所: {item.place ?? '取得中…'}
                  </Text>
                  <Text style={styles.memberText}>
                    テキスト: {item.text?.trim()?.length ? item.text : '未入力'}
                  </Text>
                  <Text style={styles.memberCoords}>
                    lat:
                    {typeof item.lat === 'number' ? item.lat.toFixed(5) : '-'}
                    {'  '}
                    lon:
                    {typeof item.lon === 'number' ? item.lon.toFixed(5) : '-'}
                  </Text>
                </View>
              </View>
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
  memberText: { marginTop: 2, fontSize: 13, color: '#333' },

  member: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  err: { marginTop: 12, color: 'red' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  thumbnailWrapper: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  memberBodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
  },
});

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
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { launchImageLibrary } from 'react-native-image-picker';
import { makePairId, addPairMessage, listenMyPairs } from '../firebase/sendRes';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/RootNavigator';
import {
  useRoomMembers,
  updateMyLocation,
  setMyPlace,
  useAuthUid,
} from '../firebase/sendRes';

type Props = NativeStackScreenProps<RootStackParamList, 'Trade'>;

type Pos = { lat: number; lon: number };

const ROOM_ID = 'demo-room-1'; // 全端末で同じにする
const NEAR_THRESHOLD_M = 80;

import type { Member } from '../firebase/sendRes'; // 型を共有
function toRad(d: number) {
  return (d * Math.PI) / 180;
}
function haversineMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export default function getMyLocation({ route, navigation }: Props) {
  const [granted, setGranted] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const placeCache = useRef(new Map<string, string>());
  const lastReverseAt = useRef(0);
  const lastCellKey = useRef<string | null>(null);
  const { uid, authErr, reauth } = useAuthUid();
  const { members, error: listenErr } = useRoomMembers(ROOM_ID);
  const [draftText, setDraftText] = useState('');
  const [draftImageUri, setDraftImageUri] = useState<string | null>(null);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  // 自分が参加するペアのメタを購読（プレビュー表示用）
  const [pairsMap, setPairsMap] = useState<Record<string, any>>({});
  useEffect(() => {
    if (!uid) return;
    const unsub = listenMyPairs(uid, ROOM_ID, setPairsMap);
    return unsub;
  }, [uid]);
  // 近接フィルタ（自分の位置がある場合）
  const nearMemberIds = new Set(
    pos
      ? members
          .filter(
            m =>
              m.id !== uid &&
              typeof m.lat === 'number' &&
              typeof m.lon === 'number',
          )
          .map(m => ({
            id: m.id,
            d: haversineMeters(pos, { lat: m.lat!, lon: m.lon! }),
          }))
          .filter(x => x.d <= NEAR_THRESHOLD_M)
          .map(x => x.id)
      : [],
  );

  const pickImage = async () => {
    const res = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.9,
    });
    if (res.didCancel || !res.assets?.[0]?.uri) return;
    setDraftImageUri(res.assets[0].uri);
  };

  const sendToPeer = async (peerId: string) => {
    if (!uid) return;
    if (!draftText.trim() && !draftImageUri) return;

    setSendingTo(peerId);
    try {
      let imageUrl: string | undefined;
      if (draftImageUri) {
        const pairId = makePairId(uid, peerId);
        const fileName = `${Date.now()}.jpg`;
        const path = `rooms/${ROOM_ID}/pairs/${pairId}/${fileName}`;
        const uploadUri =
          Platform.OS === 'ios'
            ? draftImageUri.replace('file://', '')
            : draftImageUri;
        await storage().ref(path).putFile(uploadUri);
        imageUrl = await storage().ref(path).getDownloadURL();
      }
      await addPairMessage(
        peerId,
        {
          text: draftText.trim() || undefined,
          imageUrl,
        },
        ROOM_ID,
      );

      // 送信後は下書きをクリア
      setDraftText('');
      setDraftImageUri(null);
    } catch (e) {
      console.log('send error', e);
    } finally {
      setSendingTo(null);
    }
  };

  useEffect(() => {
    if (listenErr) setError(listenErr);
  }, [listenErr]);

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

      await setMyPlace(name, ROOM_ID);
    } catch (e) {}
  }

  // 1回取得
  const getOnce = () => {
    setError(null);
    Geolocation.getCurrentPosition(
      p => {
        const lat = p.coords.latitude;
        const lon = p.coords.longitude;
        setPos({ lat, lon });
        updateMyLocation(lat, lon, ROOM_ID);
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
        updateMyLocation(lat, lon, ROOM_ID);
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
      Geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>位置情報 x Firebase</Text>
      <Text>UID: {uid ?? '-'}</Text>
      {/* 下書き入力エリア */}
      <View style={styles.compose}>
        <TextInput
          placeholder="交換用テキスト（任意）"
          value={draftText}
          onChangeText={setDraftText}
          style={styles.input}
        />
        <View style={styles.composeRow}>
          <Button title="画像を選択" onPress={pickImage} />
          {draftImageUri ? (
            <View style={styles.previewWrap}>
              <Image
                source={{ uri: draftImageUri }}
                style={styles.previewImg}
              />
              <TouchableOpacity onPress={() => setDraftImageUri(null)}>
                <Text style={styles.clear}>クリア</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
        <Text style={styles.caption}>近くの相手の行にある「送る」から配信</Text>
      </View>
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

          // ペアのプレビュー
          const pairId = uid ? makePairId(uid, item.id) : '';
          const meta = pairId ? pairsMap[pairId] : undefined;

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

              {/* プレビュー表示 */}
              {meta?.lastImageUrl ? (
                <Image
                  source={{ uri: meta.lastImageUrl }}
                  style={styles.cardImg}
                />
              ) : null}
              {meta?.lastMessagePreview ? (
                <Text style={{ marginTop: 4 }}>{meta.lastMessagePreview}</Text>
              ) : null}

              {/* 送信ボタン（自分以外、かつ近接中なら強調） */}
              {!isMe && (
                <TouchableOpacity
                  onPress={() => sendToPeer(item.id)}
                  style={[
                    styles.sendBtn,
                    nearMemberIds.has(item.id)
                      ? styles.sendBtnActive
                      : undefined,
                  ]}
                  disabled={sendingTo === item.id}
                >
                  {sendingTo === item.id ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.sendBtnLabel}>
                      {nearMemberIds.has(item.id) ? 'この人へ送る' : '送る'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
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
  compose: { width: '100%', paddingHorizontal: 16, marginTop: 8 },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },
  previewWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewImg: { width: 56, height: 56, borderRadius: 8, marginLeft: 8 },
  clear: { color: '#0A84FF', marginLeft: 4 },

  cardImg: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: '#eee',
  },
  sendBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#999',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sendBtnActive: { backgroundColor: '#0A84FF' },
  sendBtnLabel: { color: '#fff', fontWeight: '600' },
});

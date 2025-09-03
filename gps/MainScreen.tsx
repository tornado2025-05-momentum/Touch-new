import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  Text,
  StyleSheet,
  Button,
  PermissionsAndroid,
  Platform,
  View,
  ScrollView,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/RootNavigator'; // パスはご自身の環境に合わせてください

type Props = NativeStackScreenProps<RootStackParamList, 'Main'>;
type Pos = { lat: number; lon: number };
type Member = { id: string; lat?: number; lon?: number; updatedAt?: any };

const ROOM_ID = 'demo-room-1';

export default function MainScreen({ navigation }: Props) {
  const [granted, setGranted] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uid = auth().currentUser?.uid;
  const [members, setMembers] = useState<Member[]>([]);

  // 権限リクエスト (Android)
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        const res = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        setGranted(res === PermissionsAndroid.RESULTS.GRANTED);
      } else {
        // iOSの場合はinfo.plistでの設定が主
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
        },
        e => setError(`listen: ${e.message}`),
      );
    return unsub;
  }, []);

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
        uploadLocation(lat, lon);
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アカウント</Text>
          <Text>UID: {uid?.slice(0, 10)}...</Text>
          <Text>位置情報権限: {granted ? '許可' : '未許可'}</Text>
          <View style={styles.row}>
            <Button title="サインアウト" onPress={() => auth().signOut()} color="#E53935" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>機能へ移動</Text>
          <View style={styles.row}>
            <Button
              title="フォアグラウンドGPS機能"
              onPress={() => navigation.navigate('GPS')}
            />
          </View>
          <View style={styles.row}>
            <Button
              title="バックグラウンドGPS機能"
              onPress={() => navigation.navigate('Background')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>テスト用コントロール</Text>
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
            <Text style={styles.posText}>
              My Lat: {pos.lat.toFixed(6)}, Lon: {pos.lon.toFixed(6)}
            </Text>
           )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>同じ部屋のメンバー</Text>
          {error && <Text style={styles.err}>Error: {error}</Text>}
          <View>
            {members.map(item => (
              <Text key={item.id} style={styles.member}>
                {item.id.slice(0, 6)}…{' '}
                lat:{typeof item.lat === 'number' ? item.lat.toFixed(5) : '-'}
                {' '}
                lon:{typeof item.lon === 'number' ? item.lon.toFixed(5) : '-'}
                {uid && item.id === uid ? ' ← 自分' : ''}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scrollContent: { padding: 16 },
  section: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EEE', paddingBottom: 8 },
  row: { marginVertical: 6 },
  member: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DDD', fontSize: 13 },
  err: { marginVertical: 8, color: 'red' },
  posText: { textAlign: 'center', marginTop: 8, color: '#333' },
});
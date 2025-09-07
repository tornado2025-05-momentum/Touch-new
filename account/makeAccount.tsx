// App.tsx
/*import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;
type Pos = { lat: number; lon: number };
type Member = { id: string; lat?: number; lon?: number; updatedAt?: any };

const ROOM_ID = 'demo-room-1'; // 全端末で同じにする

export default function accountInit({ route, navigation }: Props) {
  const [granted, setGranted] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [initializing, setInitializing] = useState(true);

  // 起動時：認証状態を監視（匿名サインインは行わない）
  useEffect(() => {
    const unsub = auth().onAuthStateChanged(u => {
      setUid(u?.uid ?? null);
      setInitializing(false);
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

  // 1回取得
  const getOnce = () => {
    setError(null);
    Geolocation.getCurrentPosition(
      p => {
        const lat = p.coords.latitude;
        const lon = p.coords.longitude;
        setPos({ lat, lon }); // 画面にも反映
        uploadLocation(lat, lon); // Firestoreへ送信
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
        distanceFilter: 5, // 5m以上で更新（節電）
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

  // 初期化中は描画をブロック（位置情報ロジックはそのまま）
  if (initializing) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>位置情報 x Firebase</Text>
        <Text>Initializing Firebase Auth…</Text>
      </SafeAreaView>
    );
  }

  // 未ログインなら Email/Password ログイン画面を表示
  if (!uid) {
    return <EmailPasswordAuthScreen />;
  }

  // 表示（ログイン済み）
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>位置情報 x Firebase</Text>
      <Text>UID: {uid}</Text>
      <View style={styles.row}>
        <Button title="Sign out" onPress={() => auth().signOut()} />
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
        </Text>
      )}
      {error && <Text style={styles.err}>Error: {error}</Text>}

      <Text style={styles.subtitle}>同じ部屋のメンバー</Text>
      <FlatList
        style={{ width: '90%', marginTop: 8 }}
        data={members}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <Text style={styles.member}>
            {item.id.slice(0, 6)}…{'  '}
            lat:{typeof item.lat === 'number' ? item.lat.toFixed(5) : '-'}
            {'  '}
            lon:{typeof item.lon === 'number' ? item.lon.toFixed(5) : '-'}
            {item.updatedAt?.toDate?.() &&
              `  (${item.updatedAt.toDate().toLocaleTimeString()})`}
            {uid && item.id === uid ? '  ← 自分' : ''}
          </Text>
        )}
      />
    </SafeAreaView>
  );
}

/** ------ Email/Password ログイン（最小） ------ */
/*function EmailPasswordAuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!email.includes('@')) {
      setErr('メール形式が正しくありません');
      return;
    }
    if (pw.length < 6) {
      setErr('パスワードは6文字以上');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signup') {
        await auth().createUserWithEmailAndPassword(email.trim(), pw);
      } else {
        await auth().signInWithEmailAndPassword(email.trim(), pw);
      }
      // 成功すると onAuthStateChanged が発火し、App 側がログイン済みUIへ切替
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>ログイン</Text>
      <TextInput
        style={styles.input}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="パスワード（6文字以上）"
        secureTextEntry
        value={pw}
        onChangeText={setPw}
      />
      {err && <Text style={styles.err}>{err}</Text>}
      <View style={styles.row}>
        <Button
          title={busy ? '処理中…' : mode === 'signup' ? '新規登録' : 'ログイン'}
          onPress={submit}
          disabled={busy}
        />
      </View>
      <Text
        style={{ color: '#0a7', fontWeight: '600', padding: 8 }}
        onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
      >
        {mode === 'login'
          ? 'アカウントを作成する'
          : '既にアカウントをお持ちの方はこちら'}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  row: { marginVertical: 6, width: 260 },
  pos: { marginTop: 12, textAlign: 'center', fontSize: 16 },
  member: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  err: { marginTop: 12, color: 'red' },
  input: {
    width: '90%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
});*/

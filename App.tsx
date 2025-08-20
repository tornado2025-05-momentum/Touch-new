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

type Pos = {lat: number; lon: number};

export default function App() {
  const [granted, setGranted] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const getOnce = () => {
    setError(null);
    Geolocation.getCurrentPosition(
      p => setPos({lat: p.coords.latitude, lon: p.coords.longitude}),
      e => setError(e.message),
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 0},
    );
  };

  const startWatch = () => {
    if (watchId != null) return;
    const id = Geolocation.watchPosition(
      p => setPos({lat: p.coords.latitude, lon: p.coords.longitude}),
      e => setError(e.message),
      {enableHighAccuracy: true, distanceFilter: 0, interval: 2000, fastestInterval: 1000},
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
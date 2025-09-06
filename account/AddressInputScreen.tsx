import React, { useState, useRef } from 'react';
import {
  SafeAreaView, View, Text, TextInput, StyleSheet,
  Pressable, ActivityIndicator, Alert, Platform, PermissionsAndroid,
} from 'react-native';
// Import react-native-maps
import MapView, { Marker } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Config from 'react-native-config';

type Coords = { lat: number; lon: number };

// This component uses Google Maps Geocoding API.
// Ensure you have a GOOGLE_MAPS_API_KEY in your .env file.

export default function AddressInputScreen({ navigation }: any) {
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [address, setAddress] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<MapView>(null);

  // ---- Function to ensure location permission ----
  async function ensureLocationPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      if (fine !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('位置情報の権限', '位置情報の権限が許可されていません。');
        return false;
      }
      return true;
    } catch (e) {
      console.warn(e);
      Alert.alert('権限エラー', '権限の要求中にエラーが発生しました。');
      return false;
    }
  }
  
  // ---- Common function for fetching JSON from an API ----
  async function fetchJSON<T>(url: string): Promise<T | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error('API request failed:', res.status);
        return null;
      }
      return (await res.json()) as T;
    } catch (e) {
      console.error('Fetch error:', e);
      return null;
    }
  }
  
  // ---- Geocoding function (using Google Geocoding API) ----
  async function geocode(addressQuery: string) {
    const apiKey = Config.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps APIキーが設定されていません。');
      Alert.alert('設定エラー', 'アプリケーションが正しく設定されていません。');
      return null;
    }
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressQuery)}&key=${apiKey}&language=ja&region=jp`;
    
    const response = await fetchJSON<{ results: any[]; status: string }>(url);

    if (response && response.status === 'OK' && response.results.length > 0) {
      const location = response.results[0].geometry.location;
      return {
        lat: location.lat,
        lon: location.lng, // Google Maps API uses 'lng' for longitude
        display_name: response.results[0].formatted_address,
      };
    }
    return null;
  }
  
  // ---- Reverse geocoding function (using Google Geocoding API) ----
  async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
    const apiKey = Config.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps APIキーが設定されていません。');
      return '設定エラー';
    }
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${apiKey}&language=ja`;

    const response = await fetchJSON<{ results: any[]; status: string }>(url);

    if (response && response.status === 'OK' && response.results.length > 0) {
      return response.results[0].formatted_address;
    }
    return null;
  }
  
  // ---- Handler for the "Search Address" button ----
  const onSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    const r = await geocode(q);
    setLoading(false);
    if (!r) {
      Alert.alert('見つかりません', '住所をもう一度確認してください。');
      return;
    }
    const newCoords = { lat: r.lat, lon: r.lon };
    setCoords(newCoords);
    setAddress(r.display_name);
    // Animate the map to the search result
    mapRef.current?.animateToRegion({
      latitude: newCoords.lat,
      longitude: newCoords.lon,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 1000);
  };
  
  // ---- Handler for the "Use Current Location" button ----
  const useCurrentLocation = async () => {
    if (!(await ensureLocationPermission())) return;
    setLoading(true);
    Geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const addr = await reverseGeocode(latitude, longitude);
        const newCoords = { lat: latitude, lon: longitude };
        setCoords(newCoords);
        setAddress(addr ?? '不明な場所');
        setLoading(false);
        mapRef.current?.animateToRegion({
          latitude: newCoords.lat,
          longitude: newCoords.lon,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      },
      (e) => {
        setLoading(false);
        Alert.alert('現在地取得エラー', e?.message ?? '現在地の取得に失敗しました。');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  // ---- Handler for the "Register" button ----
  const onSubmit = async () => {
    if (!coords || !address.trim()) return;
    const user = auth().currentUser;
    if (!user) { Alert.alert('エラー', 'ログイン状態が無効です。'); return; }
    try {
      await firestore().collection('users').doc(user.uid).set({
        address: {
          text: address.trim(),
          lat: coords.lat,
          lon: coords.lon,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
      }, { merge: true });
      navigation.replace('Main');
    } catch (e) {
      console.error(e);
      Alert.alert('エラー', '住所の保存に失敗しました。');
    }
  };

  const canSubmit = !!coords && !!address.trim() && !loading;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>居住地を入力する</Text>
        <Text style={styles.caption}>自宅で共有しないための必要な情報です。</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="例）静岡県静岡市葵区黒金町50"
          style={styles.input}
          returnKeyType="search"
          onSubmitEditing={onSearch}
        />
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.secondaryBtn} onPress={onSearch}>
          <Text style={styles.secondaryText}>住所を検索</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={useCurrentLocation}>
          <Text style={styles.secondaryText}>現在地を使用</Text>
        </Pressable>
      </View>

      {loading && <ActivityIndicator style={{ marginVertical: 8 }} />}

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: 35.681236, // Initial position (Tokyo Station)
            longitude: 139.767125,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
        >
          {coords && (
            <Marker
              coordinate={{ latitude: coords.lat, longitude: coords.lon }}
              title="選択した地点"
            />
          )}
        </MapView>
      </View>

      {!!address && (
        <View style={styles.addressContainer}>
          <Text style={styles.label}>あなたの居住地</Text>
          <Text style={styles.addr}>{address}</Text>
        </View>
      )}

      <View style={{ flex: 1 }} />
      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryBtn, !canSubmit && styles.disabled]}
          onPress={onSubmit}
          disabled={!canSubmit}
        >
          <Text style={styles.primaryText}>登録する</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  header: { padding: 16, paddingTop: 12, paddingBottom: 0 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  caption: { marginTop: 4, color: '#6B7280', fontSize: 12 },
  searchRow: { paddingHorizontal: 16, marginTop: 8 },
  input: {
    backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
    paddingVertical: 10, paddingHorizontal: 8, fontSize: 16,
  },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 12 },
  secondaryBtn: {
    flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  secondaryText: { color: '#1F2937', fontWeight: '600' },
  mapWrap: {
    flex: 3, 
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  addressContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  label: { fontSize: 12, color: '#6B7280' },
  addr: { marginTop: 4, fontSize: 16, fontWeight: '600', color: '#111827' },
  footer: { padding: 16, alignItems: 'center' },
  primaryBtn: {
    width: '100%', height: 48, borderRadius: 12, backgroundColor: '#1E3A8A',
    alignItems: 'center', justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  disabled: { backgroundColor: '#9CA3AF' },
});

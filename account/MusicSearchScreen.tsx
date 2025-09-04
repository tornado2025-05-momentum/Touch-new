// account/MusicSearchScreen.tsx
import React, { useState } from 'react';
import {
  SafeAreaView, View, Text, TextInput, FlatList, Image,
  TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'MusicSearch'>;

type Track = { id: string; title: string; artist: string; imageUrl: string };

// iTunes API の型（★追加）
type ITunesTrack = {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100: string;
};
type ITunesResponse = { results?: ITunesTrack[] };

export default function MusicSearchScreen({ navigation, route }: Props) {
  const flow = route?.params?.flow ?? [];

  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Track[]>([]);

  const search = async () => {
    const term = q.trim();
    if (!term) return;
    setLoading(true);
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&country=JP&limit=25`
      );
      const j = (await res.json()) as ITunesResponse; // ★ unknown → 型を付与
      const list: Track[] = (j.results ?? []).map((r) => ({
        id: String(r.trackId),
        title: r.trackName,
        artist: r.artistName,
        imageUrl: r.artworkUrl100,
      }));
      setItems(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: Track }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigation.navigate('SelectionConfirmation', { track: item, flow })}
    >
      {!!item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.thumb} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{item.artist}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchArea}>
        <Text style={styles.heading}>楽曲情報を入力</Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="曲名・アーティストで検索"
          style={styles.input}
          onSubmitEditing={search}
          returnKeyType="search"
        />
      </View>

      {loading && <ActivityIndicator style={{ marginTop: 8 }} />}

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#EEE' }} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  searchArea: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  heading: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', padding: 10, borderRadius: 8, backgroundColor: '#FFF' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  thumb: { width: 48, height: 48, borderRadius: 6, marginRight: 12, backgroundColor: '#EEE' },
  title: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  artist: { marginTop: 2, fontSize: 13, color: '#6B7280' },
});

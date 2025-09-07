import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'BookSearch'>;

interface ImageLinks {
  thumbnail?: string;
  smallThumbnail?: string;
}
interface VolumeInfo {
  title?: string;
  authors?: string[];
  imageLinks?: ImageLinks;
}
interface VolumeItem {
  id: string;
  volumeInfo: VolumeInfo;
}
interface GoogleBooksResponse {
  items?: VolumeItem[];
}

export default function BookSearchScreen({ navigation, route }: Props) {
  // ← ここがポイント：残りのフローを受け取って次画面へ渡す
  const flow = route?.params?.flow ?? [];

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VolumeItem[]>([]);
  const [loading, setLoading] = useState(false);

  const searchBooks = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    try {
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}`
      );
      const json = (await res.json()) as GoogleBooksResponse;
      setResults(json.items ?? []);
    } catch (err) {
      console.error('検索エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: VolumeItem }) => {
    const v = item.volumeInfo;
    const thumb = v?.imageLinks?.smallThumbnail || v?.imageLinks?.thumbnail || '';
    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => navigation.navigate('BookDetail', { book: v, flow })}
      >
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Text>📕</Text>
          </View>
        )}
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={2}>
            {v?.title ?? 'タイトル不明'}
          </Text>
          {!!v?.authors?.length && (
            <Text style={styles.author} numberOfLines={1}>
              {v!.authors!.join(', ')}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchArea}>
        <Text style={styles.heading} accessibilityRole="header">
          あなたのお気に入りの本を選択
        </Text>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="本のタイトル・著者を入力"
          style={styles.input}
          onSubmitEditing={searchBooks}
          returnKeyType="search"
        />
      </View>

      {loading && <ActivityIndicator style={styles.loading} />}

      <FlatList
        data={results}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>キーワードを入力して検索してください</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  searchArea: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  heading: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', padding: 10, borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  loading: { marginTop: 8 },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  separator: { height: 1, backgroundColor: '#EEE' },

  item: { flexDirection: 'row', paddingVertical: 10, alignItems: 'center' },
  thumb: {
    width: 48, height: 72, borderRadius: 4, backgroundColor: '#f2f2f2', marginRight: 12,
  },
  thumbPlaceholder: {
    width: 48, height: 72, borderRadius: 4, backgroundColor: '#f2f2f2',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  meta: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  author: { marginTop: 4, fontSize: 13, color: '#6B7280' },
  empty: { padding: 16, color: '#6B7280' },
});

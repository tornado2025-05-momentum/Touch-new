import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/RootNavigator';
import { startFlow, type FlowStep } from '../navigator/flow';

type Props = NativeStackScreenProps<RootStackParamList, 'BookDetail'>;

export default function BookDetailScreen({ navigation, route }: Props) {
  // flow が型定義にない環境でも動くように安全キャスト
  const { book, flow = [] as FlowStep[] } = (route.params ?? {}) as {
    book: any;
    flow?: FlowStep[];
  };

  const thumb =
    book?.imageLinks?.thumbnail || book?.imageLinks?.smallThumbnail || '';

  const onConfirm = async () => {
    // 必要ならここで Firestore に保存する処理を追加
    // 例:
    // await firestore().collection('users').doc(auth().currentUser?.uid!).collection('books').add(book);

    // 残りのステップへ
    startFlow(navigation, flow);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.center} bounces={false}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={{ fontSize: 28 }}>📕</Text>
          </View>
        )}

        <Text style={styles.detailTitle} numberOfLines={3}>
          {book?.title ?? 'タイトル不明'}
        </Text>

        {!!book?.authors?.length && (
          <Text style={styles.detailAuthor}>{book.authors.join(', ')}</Text>
        )}

        {/* 任意の追加情報（あれば表示） */}
        {!!book?.publisher && (
          <Text style={styles.metaText}>出版社：{book.publisher}</Text>
        )}
        {!!book?.publishedDate && (
          <Text style={styles.metaText}>発行日：{book.publishedDate}</Text>
        )}
        {!!book?.description && (
          <Text style={styles.description} numberOfLines={6}>
            {book.description}
          </Text>
        )}

        <Pressable style={styles.confirmButton} onPress={onConfirm}>
          <Text style={styles.confirmButtonText}>この本を選択</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  center: {
    flexGrow: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: 180, height: 260, borderRadius: 8, backgroundColor: '#f2f2f2' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  detailTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111827',
  },
  detailAuthor: {
    marginTop: 6,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  metaText: {
    marginTop: 6,
    fontSize: 13,
    color: '#4B5563',
    textAlign: 'center',
  },
  description: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    color: '#374151',
    textAlign: 'center',
  },
  confirmButton: {
    marginTop: 24,
    backgroundColor: '#0047AB',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 28,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

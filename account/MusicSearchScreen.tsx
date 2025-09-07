import React, { useState, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
// SVGをインポート
import { Svg, Path } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/RootNavigator';
// YouTube再生ライブラリをインポート
import YoutubeIframe from 'react-native-youtube-iframe';
// Firebaseの機能をインポート
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

type Props = NativeStackScreenProps<RootStackParamList, 'MusicSearch'>;

// youtubeVideoId を含む、最終的なTrackの型定義
type Track = {
  id: string;
  title: string;
  artist: string;
  imageUrl: string;
  youtubeVideoId: string | null;
};

export default function MusicSearchScreen({ navigation, route }: Props) {
  const flow = route?.params?.flow ?? [];

  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Track[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  // YouTube再生のためのstate
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Cloud Functionを呼び出す、メインの検索ロジック
  const search = async () => {
    const term = q.trim();
    if (!term) return;

    setLoading(true);
    setItems([]);
    setSelectedTrack(null);
    setPlayingVideoId(null); // 新しい検索でプレイヤーは非表示に

    const functionUrl = `https://us-central1-server-342ba.cloudfunctions.net/searchsongs/?q=${encodeURIComponent(
      term,
    )}`;

    try {
      // ===================================================================
      // ★★★ デバッグコード スタート ★★★
      // サーバーからの生の応答をすべて確認します。
      // ===================================================================
      console.log('Requesting URL:', functionUrl);
      const response = await fetch(functionUrl);

      console.log('▼▼▼ Server Response Details ▼▼▼');

      // HTTPステータスコード（200, 401, 500 など）を表示
      console.log('Status Code:', response.status);

      // サーバーが返した応答の「本文」をテキストとして取得して表示
      // これがエラーの原因を特定する最も重要な情報です
      const responseBody = await response.text();
      console.log('Response Body:', responseBody);

      console.log('▲▲▲ Server Response Details ▲▲▲');

      // 応答が正常（200番台）の場合のみ、JSONとして処理を試みる
      if (response.ok) {
        if (!responseBody) {
          throw new Error(
            'サーバーから空のレスポンスが返されました。時間をおいて再度お試しください。',
          );
        }

        let data: any;
        try {
          data = JSON.parse(responseBody); // テキストをJSONに変換
        } catch (parseErr: any) {
          // JSONでない場合は内容の先頭だけ見せてユーザーに通知
          const preview = responseBody.slice(0, 180);
          throw new Error(
            `サーバーレスポンスの解析に失敗しました。内容: "${preview}"`,
          );
        }

        if (Array.isArray(data?.tracks?.items)) {
          const list: Track[] = data.tracks.items
            .map((item: any) => ({
              id: String(item.id ?? ''),
              title: String(item.name ?? ''),
              artist: Array.isArray(item.artists)
                ? item.artists
                    .map((a: any) => a?.name)
                    .filter(Boolean)
                    .join(', ')
                : '',
              imageUrl: item?.album?.images?.[0]?.url || '',
              youtubeVideoId: (item as any).youtubeVideoId ?? null,
            }))
            .filter((t: Track) => !!t.id);
          setItems(list);
        } else {
          setItems([]);
          Alert.alert(
            '結果なし',
            '検索結果が見つかりませんでした。キーワードを変えてお試しください。',
          );
        }
      } else {
        // 応答がエラーの場合、その内容をAlertで表示
        throw new Error(
          `サーバーからエラーが返されました (Code: ${response.status})。詳細はターミナルのログを確認してください。`,
        );
      }
      // ===================================================================
      // ★★★ デバッグコード エンド ★★★
      // ===================================================================
    } catch (e: any) {
      console.error('▼▼▼ CATCHしたエラーの詳細 ▼▼▼');
      console.error(e);
      console.error('▲▲▲ CATCHしたエラーの詳細 ▲▲▲');
      // Alertには、catchしたエラーのメッセージを表示
      Alert.alert('検索エラー', e.message);
    } finally {
      setLoading(false);
    }
  };

  // 曲をタップしたときの処理 (YouTube動画を再生)
  const handleTrackPress = (track: Track) => {
    setSelectedTrack(track); // まず曲を選択状態にする
    if (track.youtubeVideoId) {
      if (playingVideoId === track.youtubeVideoId) {
        setIsPlaying(!isPlaying);
      } else {
        setPlayingVideoId(track.youtubeVideoId);
        setIsPlaying(true);
      }
    } else {
      Alert.alert(
        '動画なし',
        'この曲に対応する再生可能な動画が見つかりませんでした。',
      );
      setPlayingVideoId(null);
    }
  };

  // クラッシュを防ぐ、修正された画面遷移ロジック
  const handleNext = async () => {
    const user = auth().currentUser;
    if (!user || !selectedTrack) return;

    setIsPlaying(false);
    setPlayingVideoId(null);

    setTimeout(async () => {
      setLoading(true);
      try {
        await firestore()
          .collection('users')
          .doc(user.uid)
          .collection('selections')
          .doc('music')
          .set({
            trackId: selectedTrack.id,
            title: selectedTrack.title,
            artist: selectedTrack.artist,
            imageUrl: selectedTrack.imageUrl,
            selectedAt: firestore.FieldValue.serverTimestamp(),
          });

        navigation.navigate('SelectionConfirmation', {
          track: selectedTrack,
          flow,
        });
      } catch (e) {
        console.error(e);
        Alert.alert('エラー', '保存に失敗しました。');
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  // プレイヤーの状態が変化したときのコールバック
  const onStateChange = useCallback((state: string) => {
    if (state === 'ended') {
      setIsPlaying(false);
    }
  }, []);

  const renderItem = ({ item }: { item: Track }) => (
    <TouchableOpacity
      style={[styles.row, selectedTrack?.id === item.id && styles.selectedRow]}
      onPress={() => handleTrackPress(item)}
    >
      {!!item.imageUrl && (
        <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {item.artist}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* YouTubeプレイヤー */}
      {playingVideoId && (
        <View style={styles.playerContainer}>
          <YoutubeIframe
            height={220}
            videoId={playingVideoId}
            play={isPlaying}
            onChangeState={onStateChange}
          />
        </View>
      )}

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
        keyExtractor={it => it.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => (
          <View style={{ height: 1, backgroundColor: '#EEE' }} />
        )}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 16,
          paddingBottom: 100,
        }}
        keyboardShouldPersistTaps="handled"
      />

      {/* 曲が選択されたら次へ進むボタンを表示 */}
      {selectedTrack && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <Path
                d="M9 5l7 7-7 7"
                stroke="white"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  playerContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  searchArea: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  selectedRow: {
    backgroundColor: '#e0eaff',
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: '#EEE',
  },
  title: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  artist: { marginTop: 2, fontSize: 13, color: '#6B7280' },
  footer: {
    padding: 24,
    alignItems: 'flex-end',
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  nextButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0047AB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

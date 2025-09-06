import React, { useState, useCallback } from 'react';
import {
  SafeAreaView, View, Text, TextInput, FlatList, Image,
  TouchableOpacity, ActivityIndicator, StyleSheet, Alert,
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

    const functionUrl = `https://searchsongs-5syklhwyua-uc.a.run.app/?q=${encodeURIComponent(term)}`;

    try {
      const response = await fetch(functionUrl);
      if (!response.ok) {
        throw new Error('サーバーからの応答が正常ではありません。');
      }
      const data: any = await response.json();

      if (data?.tracks?.items) {
        const list: Track[] = data.tracks.items.map((item: any) => ({
          id: item.id,
          title: item.name,
          artist: item.artists.map((a: any) => a.name).join(', '),
          imageUrl: item.album.images[0]?.url || '',
          youtubeVideoId: item.youtubeVideoId, // バックエンドからvideoIdを受け取る
        }));
        setItems(list);
      } else {
        setItems([]);
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('検索エラー', e.message);
    } finally {
      setLoading(false);
    }
  };

  // 曲をタップしたときの処理 (YouTube動画を再生)
  const handleTrackPress = (track: Track) => {
    setSelectedTrack(track); // まず曲を選択状態にする
    if (track.youtubeVideoId) {
      // 現在再生中の動画と同じものをタップしたら再生/停止を切り替え
      if (playingVideoId === track.youtubeVideoId) {
        setIsPlaying(!isPlaying);
      } else {
      // 違う曲をタップしたら、新しい動画を再生
        setPlayingVideoId(track.youtubeVideoId);
        setIsPlaying(true);
      }
    } else {
      Alert.alert('動画なし', 'この曲に対応する再生可能な動画が見つかりませんでした。');
      setPlayingVideoId(null);
    }
  };
  
  // クラッシュを防ぐ、修正された画面遷移ロジック
  const handleNext = async () => {
    const user = auth().currentUser;
    if (!user || !selectedTrack) return;

    // 1. まずプレイヤーを停止・非表示にする命令を出す
    setIsPlaying(false);
    setPlayingVideoId(null);

    // stateの更新が画面に反映されるのを待つため、ごくわずかな遅延を入れる
    setTimeout(async () => {
      setLoading(true);
      try {
        // 2. Firestoreへの保存処理
        await firestore().collection('users').doc(user.uid).collection('selections').doc('music').set({
          trackId: selectedTrack.id,
          title: selectedTrack.title,
          artist: selectedTrack.artist,
          imageUrl: selectedTrack.imageUrl,
          selectedAt: firestore.FieldValue.serverTimestamp(),
        });
        
        // 3. プレイヤーが完全に消えた後で、安全に画面遷移する
        navigation.navigate('SelectionConfirmation', { track: selectedTrack, flow });

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
      {!!item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.thumb} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{item.artist}</Text>
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
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#EEE' }} />}
        contentContainerStyle={{ flex: 1, paddingHorizontal: 16, paddingBottom: 100 }} // ボタンに隠れないように余白を追加
        keyboardShouldPersistTaps="handled"
      />

      {/* 曲が選択されたら次へ進むボタンを表示 */}
      {selectedTrack && (
        <View style={styles.footer}>
            <TouchableOpacity
                style={styles.nextButton}
                onPress={handleNext} 
            >
                {/* アイコンのサイズと太さを調整 */}
                <Svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                    <Path 
                        d="M9 5l7 7-7 7" // パスを調整して中央に配置
                        stroke="white" 
                        strokeWidth="3.5" // 線の太さを調整
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
  heading: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', padding: 10, borderRadius: 8, backgroundColor: '#FFF' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  selectedRow: {
    backgroundColor: '#e0eaff', // 選択中の背景色
  },
  thumb: { width: 48, height: 48, borderRadius: 6, marginRight: 12, backgroundColor: '#EEE' },
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
    // 影
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


import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView, View, Text, TextInput, StyleSheet, Pressable,
  FlatList, Image, ActivityIndicator, Alert,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/RootNavigator';
// ★ YouTube再生ライブラリをインポート
import YoutubeIframe from 'react-native-youtube-iframe';

type Props = NativeStackScreenProps<RootStackParamList, 'MusicSearch'>;

// ★ youtubeVideoId を追加
interface Track {
  id: string;
  title: string;
  artist: string;
  imageUrl: string;
  youtubeVideoId: string | null;
}

const MusicSearchScreen = ({ navigation }: Props) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  // ★ 再生中の動画IDとプレイヤーの状態を管理
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // 検索機能 (youtubeVideoId を受け取るように修正)
  const searchMusic = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResults([]);
    setPlayingVideoId(null); // 新しい検索でプレイヤーを非表示に

    const functionUrl = `https://searchsongs-5syklhwyua-uc.a.run.app/?q=${encodeURIComponent(query)}`;

    try {
      const response = await fetch(functionUrl);
      if (!response.ok) throw new Error('サーバーからの応答が正常ではありません。');
      const data: any = await response.json();

      if (data?.tracks?.items) {
        const formattedResults: Track[] = data.tracks.items.map((item: any) => ({
          id: item.id,
          title: item.name,
          artist: item.artists.map((a: any) => a.name).join(', '),
          imageUrl: item.album.images[0]?.url || '',
          youtubeVideoId: item.youtubeVideoId, // ★ バックエンドからvideoIdを受け取る
        }));
        setResults(formattedResults);
      } else {
        setResults([]);
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert('検索エラー', error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // ★ 曲をタップしたときの処理 (YouTube動画を再生)
  const handleTrackPress = (track: Track) => {
    setSelectedTrack(track); // まず曲を選択状態にする
    if (track.youtubeVideoId) {
      setPlayingVideoId(track.youtubeVideoId);
      setIsPlaying(true);
    } else {
      Alert.alert('動画なし', 'この曲に対応する再生可能な動画が見つかりませんでした。');
      setPlayingVideoId(null);
    }
  };

  // プレイヤーの状態が変化したときのコールバック
  const onStateChange = useCallback((state: string) => {
    if (state === 'ended') {
      setIsPlaying(false);
      Alert.alert('再生終了', '動画の再生が終わりました。');
    }
  }, []);

  const handleNext = async () => {
    const user = auth().currentUser;
    if (!user || !selectedTrack) return;
    
    setLoading(true);
    try {
      // Firestoreへの保存処理はそのまま
      await firestore().collection('users').doc(user.uid).collection('selections').doc('music').set({
        trackId: selectedTrack.id,
        title: selectedTrack.title,
        artist: selectedTrack.artist,
        imageUrl: selectedTrack.imageUrl,
        selectedAt: firestore.FieldValue.serverTimestamp(),
      });

      // ★ 遷移先を 'Main' から 'SelectionConfirmation' に変更
      // ★ さらに、選択した曲の情報をパラメータとして渡す
      navigation.navigate('SelectionConfirmation', { track: selectedTrack });

    } catch (e) {
      console.error(e);
      Alert.alert('エラー', '保存に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>楽曲情報を入力</Text>

        {/* ★ YouTubeプレイヤーをここに追加 */}
        {playingVideoId && (
          <View style={styles.playerContainer}>
            <YoutubeIframe
              height={200}
              videoId={playingVideoId}
              play={isPlaying}
              onChangeState={onStateChange}
            />
          </View>
        )}

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.input}
            placeholder="探している曲名を入力"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={searchMusic}
          />
        </View>
        {loading ? (
          <ActivityIndicator size="large" style={{ marginTop: 20 }}/>
        ) : (
          <FlatList
            data={results}
            keyExtractor={item => item.id}
            renderItem={({ item }) => {
              const isSelected = selectedTrack?.id === item.id;
              return (
                // ★ handleTrackPress を呼び出すように変更
                <Pressable
                  style={[styles.trackItem, isSelected && styles.selectedTrackItem]}
                  onPress={() => handleTrackPress(item)}
                >
                  {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.albumArt} /> : <View style={styles.albumArt} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trackTitle}>{item.title}</Text>
                    <Text style={styles.trackArtist}>{item.artist}</Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>
      {selectedTrack && (
        <View style={styles.footer}>
          <Pressable style={styles.nextButton} onPress={handleNext}>
             <Text style={styles.nextButtonText}>→</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f8' },
    content: { padding: 24, flex: 1 },
    title: { fontSize: 22, fontWeight: 'bold', color: '#1C1C1E', marginBottom: 16 },
    playerContainer: {
      marginBottom: 16,
      borderRadius: 12,
      overflow: 'hidden', // 角を丸くするために必要
    },
    searchContainer: { flexDirection: 'row', alignItems: 'center' },
    input: {
        flex: 1, backgroundColor: 'white', borderRadius: 8,
        paddingHorizontal: 16, paddingVertical: 12, fontSize: 16
    },
    trackItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    selectedTrackItem: {
        backgroundColor: '#dceafb',
    },
    albumArt: { width: 50, height: 50, borderRadius: 4, marginRight: 12, backgroundColor: '#ccc' },
    trackTitle: { fontSize: 16, fontWeight: '600' },
    trackArtist: { fontSize: 14, color: '#666' },
    footer: { padding: 24, alignItems: 'flex-end' },
    nextButton: {
        width: 60, height: 60, borderRadius: 30,
        backgroundColor: '#0047AB', justifyContent: 'center', alignItems: 'center'
    },
    nextButtonText: { color: 'white', fontSize: 24 },
});

export default MusicSearchScreen;
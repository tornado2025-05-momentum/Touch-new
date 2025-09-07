// account/SelectionConfirmationScreen.tsx
import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/RootNavigator';
import { startFlow } from '../navigator/flow';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'SelectionConfirmation'
>;

export default function SelectionConfirmationScreen({
  navigation,
  route,
}: Props) {
  const { track, flow = [] } = route.params ?? ({} as any);
  const onConfirm = () =>
    startFlow(navigation, Array.isArray(flow) ? flow : []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.headerText}>以下の楽曲を選択しました</Text>
        {!!track?.imageUrl && (
          <Image source={{ uri: track.imageUrl }} style={styles.albumArt} />
        )}
        <Text style={styles.title}>{track?.title ?? 'タイトル不明'}</Text>
        {!!track?.artist && <Text style={styles.artist}>{track.artist}</Text>}
        <Pressable style={styles.confirmButton} onPress={onConfirm}>
          <Text style={styles.confirmButtonText}>OK</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 32,
  },
  albumArt: {
    width: 280,
    height: 280,
    borderRadius: 12,
    marginBottom: 24,
    backgroundColor: '#eee',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1C1C1E',
  },
  artist: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 40,
  },
  confirmButton: {
    backgroundColor: '#0047AB',
    paddingVertical: 16,
    paddingHorizontal: 60,
    borderRadius: 30,
  },
  confirmButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});

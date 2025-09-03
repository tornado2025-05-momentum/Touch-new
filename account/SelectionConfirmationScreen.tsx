import React from 'react';
import { SafeAreaView, View, Text, Image, StyleSheet, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/RootNavigator'; // パスはご自身の環境に合わせてください

// 'SelectionConfirmation' スクリーンが受け取るパラメータの型を定義
type Props = NativeStackScreenProps<RootStackParamList, 'SelectionConfirmation'>;

const SelectionConfirmationScreen = ({ route, navigation }: Props) => {
  // 前の画面から渡された楽曲情報を取得
  const { track } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.headerText}>以下の楽曲を選択しました</Text>
        
        <Image source={{ uri: track.imageUrl }} style={styles.albumArt} />
        
        <Text style={styles.title}>{track.title}</Text>
        <Text style={styles.artist}>{track.artist}</Text>

        <Pressable 
          style={styles.confirmButton} 
          onPress={() => navigation.navigate('Main')} // ここから本当のメイン画面へ
        >
          <Text style={styles.confirmButtonText}>OK</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
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
  confirmButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default SelectionConfirmationScreen;
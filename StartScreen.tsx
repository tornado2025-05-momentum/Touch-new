import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from './navigator/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home Screen</Text>
      <Button
        title="フォアグランド版"
        onPress={() => navigation.navigate('GPS')}
      />
      <Button
        title="バックグラウンド版"
        onPress={() => navigation.navigate('Background')}
      />
      <Button
        title="アカウント登録・ログイン"
        onPress={() => navigation.navigate('Welcome')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
});

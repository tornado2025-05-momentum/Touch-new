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
        title="Go to Welcome"
        onPress={() => navigation.navigate('Welcome')}
      />
      <Button
        title="Go to Chat"
        onPress={() =>
          navigation.navigate('Chat', { peerUid: 'peer-demo-uid' })
        }
      />
      <Button
        title="Go to Trade"
        onPress={() => navigation.navigate('Trade')}
      />
      <Button
        title="Go to Profile"
        onPress={() => navigation.navigate('Profile')}
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

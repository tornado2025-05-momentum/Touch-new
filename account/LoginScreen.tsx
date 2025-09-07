import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const LoginScreen = ({ navigation }: Props) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    setBusy(true);
    try {
      await auth().signInWithEmailAndPassword(email.trim(), password);
      // 成功するとApp.tsxのonAuthStateChangedが検知して自動でMainScreenに遷移します
    } catch (e: any) {
      Alert.alert('ログインエラー', 'メールアドレスまたはパスワードが正しくありません。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>ログイン</Text>
        <TextInput
          style={styles.input}
          placeholder="メールアドレス"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="パスワード"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable
          style={styles.primaryButton}
          onPress={handleLogin}
          disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>ログイン</Text>
          )}
        </Pressable>

        <Pressable onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.linkText}>アカウントをお持ちでない方はこちら</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

// SignUpScreenと同じスタイルを流用できます
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f4f8',
        justifyContent: 'center',
    },
    content: {
        paddingHorizontal: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1C1C1E',
        marginBottom: 24,
        textAlign: 'center',
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        marginBottom: 16,
    },
    primaryButton: {
        backgroundColor: '#0047AB',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    linkText: {
        color: '#0047AB',
        textAlign: 'center',
        marginTop: 20,
        fontWeight: '600',
    },
});


export default LoginScreen;
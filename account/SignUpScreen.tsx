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
import type { RootStackParamList } from '../navigator/RootNavigator'; // RootNavigator.tsxから型をインポート

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

const SignUpScreen = ({ navigation }: Props) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSignUp = async () => {
    if (!email.includes('@')) {
      Alert.alert('エラー', 'メール形式が正しくありません');
      return;
    }
    if (password.length < 6) {
      Alert.alert('エラー', 'パスワードは6文字以上で入力してください');
      return;
    }

    setBusy(true);
    try {
      await auth().createUserWithEmailAndPassword(email.trim(), password);
      // 成功するとApp.tsxのonAuthStateChangedが検知して自動でMainScreenに遷移します
    } catch (e: any) {
      Alert.alert('登録エラー', e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>アカウント作成</Text>
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
          placeholder="パスワード（6文字以上）"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable
          style={styles.primaryButton}
          onPress={handleSignUp}
          disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>登録する</Text>
          )}
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Login')}>
          <Text style={styles.linkText}>
            既にアカウントをお持ちの方はこちら
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

// WelcomeScreenと似たスタイルを適用
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


export default SignUpScreen;
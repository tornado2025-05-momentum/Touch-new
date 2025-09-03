import React from 'react';
import { StyleSheet, Text, View, Pressable, StatusBar, Image } from 'react-native';
import LinearGradientComponent from 'react-native-linear-gradient';

// ★ 修正点 1: ナビゲーション用の型をインポートします
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from './navigator/RootNavigator'; // ご自身のRootNavigator.tsxへのパスを指定してください

// この画面が受け取るPropsの型を定義します
type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;


// ★ 修正点 2: Propsから { navigation } を受け取るように変更します
const WelcomeScreen = ({ navigation }: Props) => {
  return (
    <LinearGradientComponent
      colors={['#f0f4f8', '#ffffff']}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" />

      <Image
        source={require('./assets/baburu.png')} 
        style={styles.backgroundImage}
      />

      <View style={styles.content}>
        <View style={styles.textContainer}>
            <Text style={styles.title}>Touch new へようこそ</Text>
            <Text style={styles.description}>
                サービスの説明サービスの説明サービスの説明サービスの説明サービスの説明サービスの説明サービスの説明サービスの説明
            </Text>
        </View>

        <View style={styles.buttonContainer}>
            <Pressable
              style={styles.primaryButton}
              onPress={() => navigation.navigate('SignUp')}
            >
                <Text style={styles.primaryButtonText}>新規登録</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Login')}
            >
                <Text style={styles.secondaryButtonText}>ログイン</Text>
            </Pressable>
        </View>
      </View>

    </LinearGradientComponent>
  );
};

// スタイル定義は変更ありません
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  backgroundImage: {
    position: 'absolute',
    top: 40,
    width: '100%',
    height: 450,
    resizeMode: 'contain',
  },
  content: {
    width: '100%',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  textContainer: {
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 60,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    color: '#6D6D72',
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
  },
  primaryButton: {
    backgroundColor: '#0047AB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0047AB',
  },
  secondaryButtonText: {
    color: '#0047AB',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WelcomeScreen;
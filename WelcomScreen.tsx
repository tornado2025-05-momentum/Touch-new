import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  StatusBar,
  Image,
} from 'react-native';
import LinearGradientComponent from 'react-native-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// Assuming you have a RootStackParamList defined for your navigator
// Example: export type RootStackParamList = { Welcome: undefined; SignUp: undefined; ... };
import type { RootStackParamList } from './navigator/RootNavigator';

// Define the type for the screen's props
type WelcomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

const WelcomeScreen = ({ navigation }: WelcomeScreenProps) => {
  return (
    <LinearGradientComponent
      colors={['#f0f4f8', '#ffffff']}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" />

      <View style={styles.imageContainer}>
        <Image
          source={require('./assets/baburu.png')}
          style={styles.backgroundImage}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Touch new へようこそ</Text>
          <Text style={styles.description}>
            {'偶然と出会いにいこう。\n日常のすれ違いを価値観の交換に。'}
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => navigation.navigate('SignUp')} // Replace 'SignUp' with your actual screen name
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundImage: {
    width: '100%',
    height: 400,
    resizeMode: 'contain',
  },
  content: {
    width: '100%',
    paddingHorizontal: 24,
    paddingBottom: 60,
    paddingTop: 20,
  },
  textContainer: {
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 70,
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

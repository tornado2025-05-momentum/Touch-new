import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import GPScreen from '../gps/getGPS';
import { ChatScreen } from '../account/ChatScreen';
import TradeScreen from '../gps/trade';
import ProfileScreen from '../profile/ProfileScreen';
import EditProfileScreen from '../profile/EditProfileScreen';
import type { UserProfile, ContentItem } from '../profile/ProfileScreen';

// --- スクリーンコンポーネントのインポート ---
import WelcomeScreen from '../WelcomScreen';
import SignUpScreen from '../account/SignUpScreen';
import LoginScreen from '../account/LoginScreen';
import SetupProfileScreen from '../account/SetupProfileScreen';
import SelectInterestsScreen from '../account/SelectInterestsScreen';
import RecentEventScreen from '../account/RecentEventScreen';
import MusicSearchScreen from '../account/MusicSearchScreen';
import SelectionConfirmationScreen from '../account/SelectionConfirmationScreen';
import BookSearchScreen from '../account/BookSearchScreen';
import BookDetailScreen from '../account/BookDetailScreen';
import AddressInputScreen from '../account/AddressInputScreen';
import MainScreen from '../gps/MainScreen';
import HomeScreen from '../homeScreen';
import BackgroundScreen from '../gps/Background';
import type { FlowStep } from './flow';
// --- ナビゲーションの型定義を更新 ---
export type RootStackParamList = {
  // 認証フローの画面
  Welcome: undefined; //サインアウト状態の時の最初の画面
  SignUp: undefined; //アカウント登録
  Login: undefined; //ログイン

  // プロフィール設定画面
  SetupProfile: undefined; //プロフィール画像とニックネーム
  SelectInterests: undefined; //交換する情報を選択
  RecentEvent: { flow?: FlowStep[] } | undefined; //最近の出来事
  MusicSearch: { flow?: FlowStep[] } | undefined; //音楽
  SelectionConfirmation: {
    track: { id: string; title: string; artist: string; imageUrl: string };
    flow?: FlowStep[];
  }; // trackオブジェクトを渡す
  BookSearch: { flow?: FlowStep[] } | undefined; //本
  BookDetail: { book: any; flow?: FlowStep[] };
  AddressInput: undefined; //住所入力

  // ログイン後のメインアプリ画面
  Main: undefined;
  Background: undefined; // ★ 不足していた画面を追加
  Home: undefined;
  GPS: undefined;
  // ★ Chat 画面は peerUid をパラメータで受け取れるように（任意）
  Chat: { peerUid?: string } | undefined;
  Trade: undefined;
  Profile:
    | { updatedProfile?: UserProfile; updatedContent?: ContentItem[] }
    | undefined;
  EditProfile: { currentProfile: UserProfile; currentContent: ContentItem[] };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// --- 画面スタックの定義 ---

// ログイン前
const AuthStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="Welcome"
      component={WelcomeScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="SignUp"
      component={SignUpScreen}
      options={{ title: '新規登録' }}
    />
    <Stack.Screen
      name="Login"
      component={LoginScreen}
      options={{ title: 'ログイン' }}
    />
  </Stack.Navigator>
);

// ★追加: プロフィール設定用
const ProfileSetupStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="SetupProfile"
      component={SetupProfileScreen}
      options={{ title: 'プロフィール設定' }}
    />
    <Stack.Screen
      name="SelectInterests"
      component={SelectInterestsScreen}
      options={{ title: '情報選択' }}
    />
    <Stack.Screen
      name="RecentEvent"
      component={RecentEventScreen}
      options={{ title: '最近の出来事' }}
    />
    <Stack.Screen
      name="MusicSearch"
      component={MusicSearchScreen}
      options={{ title: '楽曲検索' }}
    />
    <Stack.Screen
      name="SelectionConfirmation"
      component={SelectionConfirmationScreen}
      options={{ title: '選択した楽曲' }}
    />
    <Stack.Screen
      name="BookSearch"
      component={BookSearchScreen}
      options={{ title: '本検索' }}
    />
    <Stack.Screen
      name="BookDetail"
      component={BookDetailScreen}
      options={{ title: '選択した本' }}
    />
    <Stack.Screen
      name="AddressInput"
      component={AddressInputScreen}
      options={{ title: '居住地' }}
    />
  </Stack.Navigator>
);

// ログイン後 (プロフィール作成済み)
const AppStack = () => (
  <Stack.Navigator initialRouteName="Main">
    <Stack.Screen
      name="Main"
      component={MainScreen}
      options={{ title: 'メイン' }}
    />
    <Stack.Screen
      name="Home"
      component={HomeScreen}
      options={{ title: 'Home' }}
    />
    <Stack.Screen name="GPS" component={GPScreen} options={{ title: 'GPS' }} />
    <Stack.Screen
      name="Chat"
      component={ChatScreen}
      options={{ title: 'Chat' }}
    />
    <Stack.Screen
      name="Trade"
      component={TradeScreen}
      options={{ title: 'Trade' }}
    />
    <Stack.Screen
      name="Profile"
      component={ProfileScreen}
      options={{ title: 'Profile' }}
    />
    <Stack.Screen
      name="EditProfile"
      component={EditProfileScreen}
      options={{ title: 'Edit Profile' }}
    />
    <Stack.Screen
      name="Background"
      component={BackgroundScreen}
      options={{ title: 'Background' }}
    />
  </Stack.Navigator>
);

export default function RootNavigator() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [isProfileComplete, setProfileComplete] = useState(false);

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(
      async (userState: FirebaseAuthTypes.User | null) => {
        setUser(userState);

        if (userState !== null) {
          // ログインしている場合
          const userDoc = await firestore()
            .collection('users')
            .doc(userState.uid)
            .get();

          // ★★★ ここから下を修正 ★★★
          const userData = userDoc.data();
          const exists =
            typeof (userDoc as any).exists === 'function'
              ? (userDoc as any).exists()
              : !!(userDoc as any).exists;

          const hasInterests =
            Array.isArray((userData as any)?.interests) &&
            (userData as any).interests.length > 0;

          setProfileComplete(exists && hasInterests);
          // ★★★ ここまで ★★★
        } else {
          // ログインしていない場合
          setProfileComplete(false);
        }

        if (initializing) {
          setInitializing(false);
        }
      },
    );
    return subscriber;
  }, []);
  if (initializing) {
    return null; // or a loading indicator
  }

  // ★変更: 3段階の画面切り替えロジック
  const renderStack = () => {
    if (user && isProfileComplete) {
      // ログイン済み & プロフィール完了
      return <AppStack />;
    }
    if (user && !isProfileComplete) {
      // ログイン済み & プロフィール未完了
      return <ProfileSetupStack />;
    }
    // 未ログイン
    return <AuthStack />;
  };

  return <NavigationContainer>{renderStack()}</NavigationContainer>;
}

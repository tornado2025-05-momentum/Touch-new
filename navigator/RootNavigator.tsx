import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../homeScreen';
import GPScreen from '../gps/getGPS';
import AccountScreen from '../account/makeAccount';
import { ChatScreen } from '../ChatScreen';
import TradeScreen from '../gps/trade';

export type RootStackParamList = {
  Home: undefined;
  GPS: undefined;
  Account: undefined;
  // ★ Chat 画面は peerUid をパラメータで受け取れるように（任意）
  Chat: { peerUid?: string } | undefined;
  Trade: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Home' }}
      />
      <Stack.Screen
        name="GPS"
        component={GPScreen}
        options={{ title: 'GPS' }}
      />

      <Stack.Screen
        name="Account"
        component={AccountScreen}
        options={{ title: 'Account' }}
      />
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
    </Stack.Navigator>
  );
}

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../HomeScreen';
import GPSScreen from '../gps/getGPS';
import BackgroundScreen from '../gps/Background';
import AccountScreen from '../account/makeAccount';

export type RootStackParamList = {
  Home: undefined;
  GPS: undefined;
  Background: undefined;
  Account: undefined;

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
        component={GPSScreen}
        options={{ title: 'GPS' }}
      />
      <Stack.Screen
        name="Background"
        component={BackgroundScreen}
        options={{ title: 'Background' }}
      />

      <Stack.Screen
        name="Account"
        component={AccountScreen}
        options={{ title: 'Account' }}
      />
    </Stack.Navigator>
  );
}

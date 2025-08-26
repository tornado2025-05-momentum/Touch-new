import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../HomeScreen';
import ForegroundScreen from '../gps/GetGPS';
import BackgroundScreen from '../gps/Background';


export type RootStackParamList = {
  Home: undefined;
  Foreground: undefined;
  Background: undefined;
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
        name="Foreground"
        component={ForegroundScreen}
        options={{ title: 'Foreground' }}
      />
      <Stack.Screen
        name="Background"
        component={BackgroundScreen}
        options={{ title: 'Background' }}
      />
    </Stack.Navigator>
  );
}

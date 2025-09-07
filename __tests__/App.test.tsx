/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import App from '../gps/GetGPS';
import App from '../homeScreen';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigator/RootNavigator';

const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
} as any;
const route: RouteProp<RootStackParamList, 'Home'> = {
  key: 'test-key',
  name: 'Home',
  params: undefined,
};

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App navigation={navigation} route={route} />);
  });
});

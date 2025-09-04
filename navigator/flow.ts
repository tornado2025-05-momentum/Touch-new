// navigator/flow.ts（完全置き換え）
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './RootNavigator';

export type FlowStep = 'music' | 'books' | 'recent_events';

// ★ navigate だけに絞る。setParams などは持たせない
type Nav = Pick<NativeStackNavigationProp<RootStackParamList>, 'navigate'>;

export const startFlow = (navigation: Nav, flow: FlowStep[]) => {
  if (!flow || flow.length === 0) {
    navigation.navigate('Main');
    return;
  }
  const [head, ...rest] = flow;

  switch (head) {
    case 'music':
      navigation.navigate('MusicSearch', { flow: rest });
      break;
    case 'books':
      navigation.navigate('BookSearch', { flow: rest });
      break;
    case 'recent_events':
      navigation.navigate('RecentEvent', { flow: rest });
      break;
  }
};

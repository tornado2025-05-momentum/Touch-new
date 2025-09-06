// navigator/flow.ts
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './RootNavigator';

export type FlowStep = 'music' | 'books' | 'recent_events';

// navigateだけに絞り、setParamsなどは持たせないように型を定義
type Nav = Pick<NativeStackNavigationProp<RootStackParamList>, 'navigate'>;

/**
 * 渡されたflow配列に基づいて、順番に画面遷移を実行する関数
 * @param navigation - react-navigationのnavigationオブジェクト
 * @param flow - 遷移する画面のID配列 (例: ['music', 'books'])
 */
export const startFlow = (navigation: Nav, flow: FlowStep[]) => {
  // もし処理すべきflowがもうなければ、最後の画面（住所入力）へ遷移
  if (!flow || flow.length === 0) {
    // ここを最終的に遷移させたい画面に変更してください
    navigation.navigate('AddressInput'); 
    return;
  }

  // flow配列の先頭要素(head)と、残り(rest)に分割
  const [head, ...rest] = flow;

  // 先頭要素に応じて、次の画面へ遷移
  // その際、残りのflowをパラメータとして渡す
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

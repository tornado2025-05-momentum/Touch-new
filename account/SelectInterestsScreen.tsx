import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/RootNavigator'; // パスを修正してください

type Props = NativeStackScreenProps<RootStackParamList, 'SelectInterests'>;

// 選択肢の定義
const INTERESTS = [
  { id: 'music', label: '音楽', icon: '🎵' },
  { id: 'books', label: '本', icon: '📖' },
  { id: 'recent_events', label: '最近の出来事', icon: '💬' },
];

const SelectInterestsScreen = ({ navigation }: Props) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // 項目を選択/解除する関数
  const toggleSelect = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleNext = async () => {
    if (selected.length === 0) {
      Alert.alert('選択してください', '交換する情報を1つ以上選択してください。');
      return;
    }
    
    setLoading(true);
    try {
      const user = auth().currentUser;
      if (user) {
        await firestore().collection('users').doc(user.uid).update({
          interests: selected,
        });

        // ★★★ ここからが変更点 ★★★
        // '最近の出来事'が選択されているかチェック
        if (selected.includes('recent_events')) {
          // 選択されていれば、新しい画面へ遷移
          navigation.navigate('RecentEvent');
        } else {
          // 選択されていなければ、ここでプロフィール作成完了。
          // RootNavigatorが検知して自動でMainScreenに遷移します。
          // 明示的な遷移は不要です。
        }
        if (selected.includes('music')) {
          navigation.navigate('MusicSearch'); // 音楽画面へ
        } else if (selected.includes('recent_events')) {
          navigation.navigate('RecentEvent'); // 最近の出来事画面へ
        }
        // ★★★ ここまで ★★★
      }
    } catch (e) {
      console.error(e);
      Alert.alert('エラー', '情報の保存に失敗しました。');
    } finally {
      setLoading(false);
    }
};

  const isNextButtonDisabled = selected.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>交換する情報を{'\n'}1つ以上選択してください</Text>

        <View style={styles.selectionContainer}>
          {INTERESTS.map(interest => {
            const isSelected = selected.includes(interest.id);
            return (
              <TouchableOpacity
                key={interest.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => toggleSelect(interest.id)}>
                <Text style={styles.icon}>{interest.icon}</Text>
                <Text style={styles.label}>{interest.label}</Text>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      
      <View style={styles.footer}>
        <Pressable
          style={[styles.nextButton, isNextButtonDisabled && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={loading}>
          {loading ? <ActivityIndicator color="#FFFFFF"/> : <Text style={styles.nextButtonText}>→</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f8' },
    content: { padding: 24, flex: 1 },
    title: { fontSize: 22, fontWeight: 'bold', color: '#1C1C1E', marginBottom: 32 },
    selectionContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    card: {
        width: '48%',
        aspectRatio: 1,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 2,
        borderColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardSelected: {
        borderColor: '#007AFF',
        backgroundColor: '#EBF5FF',
    },
    icon: { fontSize: 40, marginBottom: 8 },
    label: { fontSize: 16, fontWeight: '500' },
    checkbox: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#B0B0B0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxSelected: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    checkmark: { color: 'white', fontSize: 14, fontWeight: 'bold' },
    footer: { padding: 24, alignItems: 'flex-end' },
    nextButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#0047AB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    nextButtonDisabled: { backgroundColor: '#A0A0A0' },
    nextButtonText: { color: 'white', fontSize: 24 },
});


export default SelectInterestsScreen;
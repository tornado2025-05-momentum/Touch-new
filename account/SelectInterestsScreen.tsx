// account/SelectInterestsScreen.tsx
import React, { useState } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, Pressable,
  Alert, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/RootNavigator';
import { startFlow, type FlowStep } from '../navigator/flow';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectInterests'>;

const INTERESTS = [
  { id: 'music', label: '音楽', icon: '🎵' },
  { id: 'books', label: '本', icon: '📖' },
  { id: 'recent_events', label: '最近の出来事', icon: '💬' },
];

export default function SelectInterestsScreen({ navigation }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleNext = async () => {
    if (selected.length === 0) {
      Alert.alert('選択してください', '交換する情報を1つ以上選択してください。');
      return;
    }
    setLoading(true);
    try {
      const user = auth().currentUser;
      if (!user) { Alert.alert('エラー', 'ログイン状態が無効です。'); return; }

      await firestore().collection('users').doc(user.uid).set({ interests: selected }, { merge: true });

      // 音楽 → 本 → 最近の出来事
      const flow: FlowStep[] = [];
      if (selected.includes('music')) flow.push('music');
      if (selected.includes('books')) flow.push('books');
      if (selected.includes('recent_events')) flow.push('recent_events');

      startFlow(navigation, flow);
    } catch (e) {
      console.error(e);
      Alert.alert('エラー', '情報の保存に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const isNextDisabled = loading || selected.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>交換する情報を{'\n'}1つ以上選択してください</Text>

        <View style={styles.selectionContainer}>
          {INTERESTS.map(item => {
            const isSelected = selected.includes(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => toggleSelect(item.id)}
              >
                <Text style={styles.icon}>{item.icon}</Text>
                <Text style={styles.label}>{item.label}</Text>
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
          style={[styles.nextButton, isNextDisabled && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={isNextDisabled}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextButtonText}>→</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  content: { padding: 24, flex: 1 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1C1C1E', marginBottom: 32 },
  selectionContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: '48%', aspectRatio: 1, backgroundColor: 'white', borderRadius: 20, padding: 16,
    marginBottom: 16, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center',
  },
  cardSelected: { borderColor: '#007AFF', backgroundColor: '#EBF5FF' },
  icon: { fontSize: 40, marginBottom: 8 },
  label: { fontSize: 16, fontWeight: '500' },
  checkbox: {
    position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: '#B0B0B0', justifyContent: 'center', alignItems: 'center',
  },
  checkboxSelected: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  checkmark: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  footer: { padding: 24, alignItems: 'flex-end' },
  nextButton: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#0047AB', justifyContent: 'center', alignItems: 'center',
  },
  nextButtonDisabled: { backgroundColor: '#A0A0A0' },
  nextButtonText: { color: 'white', fontSize: 24 },
});

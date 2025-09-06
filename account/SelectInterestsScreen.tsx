// account/SelectInterestsScreen.tsx
import React, { useState } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, Pressable,
  Alert, ActivityIndicator, TouchableOpacity,
} from 'react-native';
// SVGをインポート
import { Svg, Path } from 'react-native-svg';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/RootNavigator';
import { startFlow, type FlowStep } from '../navigator/flow';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectInterests'>;

// --- アイコンコンポーネントの定義 ---
const MusicIcon = ({ color }: { color: string }) => (
  <Svg width="48" height="48" viewBox="0 0 24 24" fill="none">
    <Path d="M9 18V5l12-2v13M9 18a3 3 0 100-6 3 3 0 000 6zm12-2a3 3 0 100-6 3 3 0 000 6z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const BookIcon = ({ color }: { color: string }) => (
  <Svg width="48" height="48" viewBox="0 0 24 24" fill="none">
    <Path d="M4 19.5A2.5 2.5 0 016.5 17H20v2H6.5A2.5 2.5 0 014 16.5v-11A2.5 2.5 0 016.5 3H20v14H6.5A2.5 2.5 0 014 14.5v-9zM20 17H6.5a2.5 2.5 0 010-5H20v5z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const MessageIcon = ({ color }: { color: string }) => (
  <Svg width="48" height="48" viewBox="0 0 24 24" fill="none">
    <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
// ------------------------------------

const INTERESTS = [
  { id: 'music', label: '音楽', Icon: MusicIcon, color: '#FF6347' },
  { id: 'books', label: '本', Icon: BookIcon, color: '#4682B4' },
  { id: 'recent_events', label: '最近の出来事', Icon: MessageIcon, color: '#32CD32' },
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
            const cardStyle = [
              styles.card,
              isSelected && { ...styles.cardSelected, borderColor: item.color, backgroundColor: `${item.color}20` }
            ];
            return (
              <TouchableOpacity
                key={item.id}
                style={cardStyle}
                onPress={() => toggleSelect(item.id)}
              >
                <item.Icon color={isSelected ? item.color : '#A0A0A0'} />
                <Text style={[styles.label, isSelected && { color: item.color }]}>{item.label}</Text>
                <View style={[styles.checkbox, isSelected && { ...styles.checkboxSelected, backgroundColor: item.color, borderColor: item.color }]}>
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
          {loading 
            ? <ActivityIndicator color="#fff" /> 
            : (
              <Svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <Path 
                  d="M9 5l7 7-7 7"
                  stroke="white" 
                  strokeWidth="3.5"
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
              </Svg>
            )
          }
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
    marginBottom: 16, borderWidth: 2, borderColor: '#E0E0E0', alignItems: 'center', justifyContent: 'center',
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  cardSelected: {
    // borderColor and backgroundColor will be set dynamically
  },
  label: { fontSize: 16, fontWeight: '600', color: '#A0A0A0', marginTop: 8 },
  checkbox: {
    position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: '#B0B0B0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff',
  },
  checkboxSelected: {
    // backgroundColor and borderColor will be set dynamically
  },
  checkmark: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  footer: { padding: 24, alignItems: 'flex-end' },
  nextButton: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#0047AB', justifyContent: 'center', alignItems: 'center',
  },
  nextButtonDisabled: { backgroundColor: '#A0A0A0' },
});


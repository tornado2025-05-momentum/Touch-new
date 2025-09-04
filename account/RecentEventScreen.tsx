// account/RecentEventScreen.tsx
import React, { useState } from 'react';
import {
  SafeAreaView, View, Text, TextInput, StyleSheet, Pressable,
  Alert, ActivityIndicator, Image, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/RootNavigator';
import { startFlow, type FlowStep } from '../navigator/flow';

type Props = NativeStackScreenProps<RootStackParamList, 'RecentEvent'>;

export default function RecentEventScreen({ navigation, route }: Props) {
  const flow = (route?.params?.flow ?? []) as FlowStep[];
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleChoosePhoto = () => {
    launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.9 }, (res) => {
      setImageUri(res.assets?.[0]?.uri ?? null);
    });
  };

  const handleNext = async () => {
    const user = auth().currentUser;
    if (!user) { Alert.alert('エラー', 'ログイン状態が無効です。'); return; }
    if (!imageUri || !description.trim()) {
      Alert.alert('入力エラー', '画像とひとことの両方を入力してください。');
      return;
    }

    setUploading(true);
    try {
      const eventId = `${Date.now()}`;
      const ref = storage().ref(`recent_events/${user.uid}/${eventId}.jpg`);
      const path = Platform.OS === 'ios' && imageUri.startsWith('file://') ? imageUri.replace('file://', '') : imageUri;
      await ref.putFile(path);
      const photoURL = await ref.getDownloadURL();

      await firestore().collection('users').doc(user.uid).collection('events').add({
        description: description.trim(),
        photoURL,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      startFlow(navigation, flow);
    } catch (e) {
      console.error(e);
      Alert.alert('エラー', '情報の保存に失敗しました。');
    } finally {
      setUploading(false);
    }
  };

  const disabled = !imageUri || !description.trim() || uploading;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.content}>
          <Text style={styles.title}>最近の出来事を入力</Text>

          <TouchableOpacity style={styles.imagePicker} onPress={handleChoosePhoto}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderText}>🖼️</Text>
              </View>
            )}
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="ひとこと"
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <View style={styles.footer}>
          <Pressable
            style={[styles.nextButton, disabled && styles.nextButtonDisabled]}
            onPress={handleNext}
            disabled={disabled}
          >
            {uploading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.nextButtonText}>→</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  content: { padding: 24, flex: 1, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1C1C1E', marginBottom: 32, alignSelf: 'flex-start' },
  imagePicker: { alignSelf: 'center', marginBottom: 24 },
  imagePreview: { width: 200, height: 200, borderRadius: 12 },
  imagePlaceholder: {
    width: 200, height: 200, borderRadius: 12, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center',
  },
  imagePlaceholderText: { fontSize: 50 },
  input: {
    backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#B0B0B0',
    paddingHorizontal: 8, paddingVertical: 12, fontSize: 16,
  },
  footer: { padding: 24, alignItems: 'flex-end' },
  nextButton: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#0047AB', justifyContent: 'center', alignItems: 'center',
  },
  nextButtonDisabled: { backgroundColor: '#A0A0A0' },
  nextButtonText: { color: 'white', fontSize: 24 },
});

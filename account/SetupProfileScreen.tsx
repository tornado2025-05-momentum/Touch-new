import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/RootNavigator'; // パスを確認・修正してください

type Props = NativeStackScreenProps<RootStackParamList, 'SetupProfile'>;

const SetupProfileScreen = ({ navigation }: Props) => {
  const [nickname, setNickname] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleChoosePhoto = () => {
    launchImageLibrary({ mediaType: 'photo' }, response => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.errorCode) {
        console.log('ImagePicker Error: ', response.errorMessage);
      } else if (response.assets && response.assets.length > 0) {
        setImageUri(response.assets[0].uri || null);
      }
    });
  };

  const handleCreateProfile = async () => {
    const user = auth().currentUser;
    if (!user) return;
    if (!nickname.trim()) {
        Alert.alert('エラー', 'ニックネームを入力してください。');
        return;
    }

    setUploading(true);
    let photoURL = null;

    try {
      if (imageUri) {
        const reference = storage().ref(`profile_pictures/${user.uid}`);
        await reference.putFile(imageUri);
        photoURL = await reference.getDownloadURL();
      }

      await firestore().collection('users').doc(user.uid).set({
        nickname: nickname.trim(),
        photoURL: photoURL,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      
      navigation.navigate('SelectInterests');

    } catch (e) {
      console.error(e);
      Alert.alert('エラー', 'プロフィールの作成に失敗しました。');
    } finally {
      setUploading(false);
    }
  };

  const isButtonDisabled = !nickname.trim() || uploading;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>アカウント情報を入力</Text>

        <TouchableOpacity style={styles.avatarPicker} onPress={handleChoosePhoto}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>+</Text>
            </View>
          )}
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="ニックネーム"
          value={nickname}
          onChangeText={setNickname}
        />

        <Pressable
          style={[styles.primaryButton, isButtonDisabled && styles.disabledButton]}
          onPress={handleCreateProfile}
          disabled={isButtonDisabled}>
          {uploading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>作成する</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f4f8',
        justifyContent: 'center',
    },
    content: {
        paddingHorizontal: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1C1C1E',
        marginBottom: 32,
        textAlign: 'center',
    },
    avatarPicker: {
        alignSelf: 'center',
        marginBottom: 24,
    },
    avatarImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    avatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#E0E0E0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarPlaceholderText: {
        fontSize: 40,
        color: '#FFFFFF',
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#B0B0B0',
        paddingHorizontal: 8,
        paddingVertical: 12,
        fontSize: 16,
        marginBottom: 32,
    },
    primaryButton: {
        backgroundColor: '#0047AB',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    disabledButton: {
        backgroundColor: '#A0A0A0',
    },
});

export default SetupProfileScreen;
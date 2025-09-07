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
// SVGをインポート
import { Svg, Path } from 'react-native-svg';
import { launchImageLibrary } from 'react-native-image-picker';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigator/RootNavigator'; 

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
      </View>
      
      {/* フローティング矢印ボタンに変更 */}
      <View style={styles.footer}>
        <Pressable
            style={[styles.nextButton, isButtonDisabled && styles.nextButtonDisabled]}
            onPress={handleCreateProfile}
            disabled={isButtonDisabled}>
            {uploading ? (
            <ActivityIndicator color="#FFFFFF" />
            ) : (
            <Svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <Path 
                    d="M9 5l7 7-7 7"
                    stroke="white" 
                    strokeWidth="3.5"
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                />
            </Svg>
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
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingBottom: 80, // ボタンに隠れないように余白を追加
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
    footer: {
        position: 'absolute',
        bottom: 24,
        right: 24,
    },
    nextButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#0047AB',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    nextButtonDisabled: {
        backgroundColor: '#A0A0A0',
    },
});

export default SetupProfileScreen;

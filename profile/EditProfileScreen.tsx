import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Button,
  SafeAreaView,
  Alert,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigator/RootNavigator';
import { ContentItem, UserProfile } from './ProfileScreen';
import {
  launchImageLibrary,
  ImageLibraryOptions,
} from 'react-native-image-picker';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import { v4 as uuidv4 } from 'uuid';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export default function EditProfileScreen({ navigation, route }: Props) {
  const { currentProfile, currentContent } = route.params;

  const [name, setName] = useState(currentProfile.name);
  const [affiliation, setAffiliation] = useState(currentProfile.affiliation);
  const [avatarUrl, setAvatarUrl] = useState(currentProfile.avatarUrl);
  const [content, setContent] = useState<ContentItem[]>(currentContent);
  const [isSaving, setIsSaving] = useState(false);
  const [newImage, setNewImage] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState<
    'all' | 'music' | 'books' | 'recent'
  >('all');

  const selectImage = () => {
    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      maxWidth: 300,
      maxHeight: 300,
      quality: 1,
    };

    launchImageLibrary(options, response => {
      if (response.assets && response.assets.length > 0) {
        setAvatarUrl(response.assets[0].uri || '');
      }
    });
  };

  const selectContentImage = (itemId?: string) => {
    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      maxWidth: 300,
      maxHeight: 300,
      quality: 1,
    };

    launchImageLibrary(options, response => {
      if (response.assets && response.assets.length > 0) {
        const uri = response.assets[0].uri || '';
        if (itemId) {
          setContent(prevContent =>
            prevContent.map(item =>
              item.id === itemId ? { ...item, uri: uri } : item,
            ),
          );
        } else {
          setNewImage(uri);
        }
      }
    });
  };

  const handleAddContent = () => {
    if (!newImage) {
      Alert.alert('エラー', '写真を選択してください。');
      return;
    }

    const newItem: ContentItem = {
      id: uuidv4(),
      type: 'image',
      uri: newImage,
      text: newComment,
      category: activeTab !== 'all' ? activeTab : 'recent',
    };
    setContent(prevContent => [...prevContent, newItem]);
    setNewImage(null);
    setNewComment('');
  };

  const handleUpdateContentText = (id: string, newText: string) => {
    setContent(prevContent =>
      prevContent.map(item =>
        item.id === id ? { ...item, text: newText } : item,
      ),
    );
  };

  const handleRemoveContent = (id: string) => {
    setContent(prevContent => prevContent.filter(item => item.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const user = auth().currentUser;
    if (!user) {
      Alert.alert('エラー', '認証されていません。');
      setIsSaving(false);
      return;
    }

    let newAvatarUrl = avatarUrl;
    if (avatarUrl && avatarUrl.startsWith('file://')) {
      const storageRef = storage().ref(`avatars/${user.uid}`);
      try {
        await storageRef.putFile(avatarUrl);
        newAvatarUrl = await storageRef.getDownloadURL();
      } catch (e) {
        Alert.alert('エラー', 'プロフィール画像のアップロードに失敗しました。');
        setIsSaving(false);
        return;
      }
    }

    try {
      await firestore().collection('users').doc(user.uid).set(
        {
          name,
          affiliation,
          avatarUrl: newAvatarUrl,
          content,
        },
        { merge: true },
      );
      Alert.alert('成功', 'プロフィールを保存しました。');
      // Firestore購読でProfile側が最新を取得するため、スタックを積まずに戻る
      navigation.goBack();
    } catch (e) {
      console.error(e);
      Alert.alert('エラー', 'プロフィールの保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredContent =
    activeTab === 'all'
      ? content
      : content.filter(item => item.category === activeTab);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={16} // ここを追加
        removeClippedSubviews={true} // ここを追加
      >
        <Text style={styles.sectionTitle}>基本情報</Text>
        <View style={styles.avatarContainer}>
          <Image
            style={styles.avatar}
            source={{ uri: avatarUrl || 'https://placeimg.com/200/200/any' }}
          />
          <TouchableOpacity
            style={styles.changeAvatarButton}
            onPress={selectImage}
            disabled={isSaving}
          >
            <Text style={styles.changeAvatarText}>プロフィール写真を変更</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>名前</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          editable={!isSaving}
        />
        <Text style={styles.label}>所属</Text>
        <TextInput
          style={styles.input}
          value={affiliation}
          onChangeText={setAffiliation}
          editable={!isSaving}
        />

        <Text style={styles.sectionTitle}>コンテンツ編集</Text>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'all' && styles.activeTab]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={activeTab === 'all' && styles.activeTabText}>
              すべて
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'music' && styles.activeTab]}
            onPress={() => setActiveTab('music')}
          >
            <Text style={activeTab === 'music' && styles.activeTabText}>
              音楽
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'books' && styles.activeTab]}
            onPress={() => setActiveTab('books')}
          >
            <Text style={activeTab === 'books' && styles.activeTabText}>
              本
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'recent' && styles.activeTab]}
            onPress={() => setActiveTab('recent')}
          >
            <Text style={activeTab === 'recent' && styles.activeTabText}>
              最近の出来事
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionSubTitle}>現在のコンテンツ</Text>
        <View style={styles.currentContentList}>
          {filteredContent.map(item => (
            <View key={item.id} style={styles.contentItem}>
              <TouchableOpacity
                onPress={() => selectContentImage(item.id)}
                style={styles.contentImageWrapper}
              >
                <Image source={{ uri: item.uri }} style={styles.contentImage} />
                <View style={styles.contentImageOverlay} />
              </TouchableOpacity>
              <View style={styles.contentItemText}>
                <TextInput
                  style={styles.contentText}
                  value={item.text}
                  onChangeText={newText =>
                    handleUpdateContentText(item.id, newText)
                  }
                  editable={!isSaving}
                />
              </View>
              <TouchableOpacity
                onPress={() => handleRemoveContent(item.id)}
                style={styles.removeButton}
              >
                <Text style={styles.removeButtonText}>削除</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <Text style={styles.sectionSubTitle}>新しいコンテンツを追加</Text>
        <TouchableOpacity
          onPress={() => selectContentImage()}
          style={[styles.imagePicker, newImage && styles.imagePickerActive]}
        >
          {newImage ? (
            <Image source={{ uri: newImage }} style={styles.newImage} />
          ) : (
            <Text style={styles.imagePickerText}>写真を選択</Text>
          )}
        </TouchableOpacity>
        <TextInput
          style={styles.commentInput}
          placeholder="一言コメント"
          value={newComment}
          onChangeText={setNewComment}
        />
        <TouchableOpacity
          onPress={handleAddContent}
          style={styles.addButton}
          disabled={!newImage || isSaving}
        >
          <Text style={styles.addButtonText}>追加</Text>
        </TouchableOpacity>
      </ScrollView>
      <View style={styles.saveButtonContainer}>
        <TouchableOpacity
          onPress={handleSave}
          style={styles.saveButton}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>保存</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8FA',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
    letterSpacing: 0,
  },
  sectionSubTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginTop: 15,
    marginBottom: 8,
    letterSpacing: 0,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E0E0E0',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#ccc',
  },
  changeAvatarButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#E6F0F8',
    borderRadius: 20,
  },
  changeAvatarText: {
    color: '#007aff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginTop: 10,
    letterSpacing: 0,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginTop: 5,
    fontSize: 16,
    color: '#333',
    letterSpacing: 0,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginTop: 20,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007aff',
  },
  activeTabText: {
    color: '#007aff',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0,
  },
  imagePicker: {
    width: '100%',
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  imagePickerActive: {
    borderColor: '#007aff',
  },
  imagePickerText: {
    color: '#888',
    fontSize: 16,
    letterSpacing: 0,
  },
  newImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    fontSize: 16,
    color: '#333',
    letterSpacing: 0,
  },
  addButton: {
    backgroundColor: '#007aff',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0,
  },
  currentContentList: {
    marginBottom: 20,
  },
  contentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  contentImageWrapper: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#E0E0E0',
    position: 'relative',
  },
  contentImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    resizeMode: 'cover',
  },
  contentImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
  },
  contentItemText: {
    flex: 1,
    marginRight: 10,
  },
  contentText: {
    fontSize: 14,
    color: '#333',
    borderBottomWidth: 1,
    borderColor: '#E0E0E0',
    paddingVertical: 4,
    letterSpacing: 0,
  },
  removeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEEEEE',
  },
  removeButtonText: {
    color: '#FF6464',
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 0,
  },
  saveButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#F5F8FA',
    borderTopWidth: 1,
    borderColor: '#E0E0E0',
  },
  saveButton: {
    backgroundColor: '#007aff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 0,
  },
});

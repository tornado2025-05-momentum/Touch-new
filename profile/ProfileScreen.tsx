import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Button } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigator/RootNavigator';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export type UserProfile = {
  name: string;
  affiliation: string;
  avatarUrl?: string;
  todayConnections: number;
  totalConnections: number; // 追加
  totalConnectionPlace: string;
  content?: ContentItem[];
};

export type ContentItem = {
  id: string;
  type: 'image' | 'text';
  uri: string;
  text: string;
  category: 'music' | 'books' | 'recent';
};

const initialProfile: UserProfile = {
  name: 'Akira',
  affiliation: '学生',
  avatarUrl: 'https://placeimg.com/200/200/any',
  todayConnections: 0,
  totalConnections: 0,
  totalConnectionPlace: '位置情報から取得',
};

const dummyContent: ContentItem[] = [
  { id: '1', type: 'image', uri: 'https://placeimg.com/150/150/nature', text: 'Radを見るために山口まで行っ...', category: 'music' },
  { id: '2', type: 'image', uri: 'https://placeimg.com/150/150/arch', text: 'たんぱく質の...', category: 'books' },
  { id: '3', type: 'image', uri: 'https://placeimg.com/150/150/tech', text: '何か一言...', category: 'recent' },
  { id: '4', type: 'image', uri: 'https://placeimg.com/150/150/people', text: '別の写真', category: 'music' },
  { id: '5', type: 'image', uri: 'https://placeimg.com/150/150/nature', text: '別の写真2', category: 'books' },
  { id: '6', type: 'image', uri: 'https://placeimg.com/150/150/tech', text: '別の写真3', category: 'recent' },
];

const TodayConnectionsIcon = () => (
  <View style={[styles.statIconBackground, { backgroundColor: '#E4F4F8' }]}>
    <Image source={{ uri: 'https://img.icons8.com/ios-filled/50/4B87C2/user.png' }} style={[styles.statIcon, { tintColor: '#4B87C2' }]} />
  </View>
);

const TotalConnectionsIcon = () => (
  <View style={[styles.statIconBackground, { backgroundColor: '#F0EAF8' }]}>
    <Image source={{ uri: 'https://img.icons8.com/ios-filled/50/8D64A2/user.png' }} style={[styles.statIcon, { tintColor: '#8D64A2' }]} />
  </View>
);

const ClockIcon = () => <Image source={{ uri: 'https://img.icons8.com/material-rounded/24/999999/clock.png' }} style={{ width: 12, height: 12, tintColor: '#999' }} />;

export default function ProfileScreen({ navigation, route }: Props) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'music' | 'books' | 'recent'>('all');
  const [content, setContent] = useState<ContentItem[]>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      const user = auth().currentUser;
      if (user) {
        const userRef = firestore().collection('users').doc(user.uid);
        const unsubscribe = userRef.onSnapshot(docSnapshot => {
          if (docSnapshot.exists) {
            const profileData = docSnapshot.data() as UserProfile;
            setUserProfile({ ...initialProfile, ...profileData });
            if (profileData.content) {
              setContent(profileData.content);
            }
          } else {
            setUserProfile(initialProfile);
          }
        }, err => {
          console.error("Firestore listen failed: ", err);
          setUserProfile(initialProfile);
        });

        const navUnsubscribe = navigation.addListener('focus', () => {
          if (route.params?.updatedProfile) {
            setUserProfile(route.params.updatedProfile);
          }
          if (route.params?.updatedContent) {
            setContent(route.params.updatedContent);
          }
        });

        return () => {
          unsubscribe();
          navUnsubscribe();
        };
      } else {
        setUserProfile(initialProfile);
      }
    };
    fetchProfile();
  }, [navigation, route.params]);

  if (!userProfile) {
    return (
      <View style={styles.container}>
        <Text>Loading profile...</Text>
      </View>
    );
  }

  const filteredContent = activeTab === 'all'
    ? content
    : content.filter(item => item.category === activeTab);

  return (
    <LinearGradient
      colors={["#DEEEFF", "#E9F4FF", "#F9FCFF", "#FFFFFF"]}
      locations={[0, 0.3, 0.7, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Image source={{ uri: 'https://img.icons8.com/ios/50/back--v1.png' }} style={styles.backIcon} /> 
          </TouchableOpacity>
          
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <TouchableOpacity 
              style={styles.chatButton}
              onPress={() => navigation.navigate('Chat')}
            >
              <Image 
                source={{ uri: 'https://img.icons8.com/material-outlined/24/000000/chat.png' }}
                style={styles.chatIcon}
              />
              <Text style={styles.chatButtonText}>Chat</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileInfoContainer}>
          <TouchableOpacity onPress={() => navigation.navigate('EditProfile', { currentProfile: userProfile, currentContent: content })}>
            <Image
              style={styles.avatar}
              source={{ uri: userProfile.avatarUrl || 'https://placeimg.com/200/200/any' }}
            />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.userName}>{userProfile.name}</Text>
            <View style={styles.affiliationRow}>
              <ClockIcon />
              <Text style={styles.affiliation}>{userProfile.affiliation}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <TodayConnectionsIcon />
            <Text style={styles.statLabel}>今日出会った回数</Text>
            <Text style={styles.statValue}>{userProfile.todayConnections}回</Text>
          </View>

          <View style={styles.statCard}>
            <TotalConnectionsIcon />
            <Text style={styles.statLabel}>今まで出会った回数</Text>
            <Text style={styles.statValue}>{userProfile.totalConnections}回</Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => navigation.navigate('EditProfile', { currentProfile: userProfile, currentContent: content })}
          >
            <Text style={styles.editProfileButtonText}>プロフィールを編集</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'all' && styles.activeTab]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={activeTab === 'all' && styles.activeTabText}>すべて</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'music' && styles.activeTab]}
            onPress={() => setActiveTab('music')}
          >
            <Text style={activeTab === 'music' && styles.activeTabText}>音楽</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'books' && styles.activeTab]}
            onPress={() => setActiveTab('books')}
          >
            <Text style={activeTab === 'books' && styles.activeTabText}>本</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'recent' && styles.activeTab]}
            onPress={() => setActiveTab('recent')}
          >
            <Text style={activeTab === 'recent' && styles.activeTabText}>最近の出来事</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contentContainer}>
          {filteredContent.map(item => (
            <View key={item.id} style={styles.contentItem}>
              <Image style={styles.contentImage} source={{ uri: item.uri }} />
              <LinearGradient
                colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.8)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.contentOverlay}
              >
                <Text style={styles.overlayText}>{item.text}</Text>
              </LinearGradient>
            </View>
          ))}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
  },
  backButton: {
    paddingRight: 10,
  },
  backIcon: {
    width: 24,
    height: 24,
    tintColor: '#333',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  chatIcon: {
    width: 18,
    height: 18,
    tintColor: '#333',
    marginRight: 4,
  },
  chatButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  profileInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#eee',
    marginRight: 16,
  },
  headerText: {},
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  calendarIcon: {
    width: 16,
    height: 16,
    tintColor: '#999',
    marginRight: 4,
  },
  dateText: {
    fontSize: 16,
    color: '#666',
  },
  affiliationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  affiliation: {
    fontSize: 16,
    color: '#666',
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  statIconBackground: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statIcon: {
    width: 30,
    height: 30,
  },
  statLabel: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
    fontWeight: 'normal',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'left',
  },
  statLocation: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'left',
    lineHeight: 24,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  editProfileButton: {
    backgroundColor: '#fff',
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
  },
  editProfileButtonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#333',
  },
  activeTabText: {
    color: '#333',
    fontWeight: 'bold',
  },
  contentContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  contentItem: {
    width: '48%',
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  contentImage: {
    width: '100%',
    height: 180,
  },
  contentOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  overlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
import { useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

export function useAuthUid() {
  const [uid, setUid] = useState<string | null>(
    auth().currentUser?.uid ?? null,
  );
  const [authErr, setAuthErr] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth().onAuthStateChanged(u => setUid(u?.uid ?? null));
    return unsub;
  }, []);

  const reauth = async () => {
    try {
      setAuthErr(null);
      await ensureAnonAuth();
    } catch (e: any) {
      setAuthErr(`${e.code || 'auth'}: ${e.message || String(e)}`);
    }
  };

  // 起動時/未ログイン時は自動で匿名サインイン
  useEffect(() => {
    if (!uid) reauth();
  }, [uid]);

  return { uid, authErr, reauth };
}

export type Member = {
  id: string;
  lat?: number;
  lon?: number;
  updatedAt?: any;
  place?: string;
  text?: string;
};

export const DEFAULT_ROOM_ID = 'demo-room-1';

function roomCol(roomId: string) {
  return firestore().collection('rooms').doc(roomId).collection('members');
}

export async function ensureAnonAuth(): Promise<string> {
  const cur = auth().currentUser;
  if (cur) return cur.uid;
  const cred = await auth().signInAnonymously();
  return cred.user.uid;
}

/** Firestore 購読（関数版） */
export function listenMembers(
  roomId = DEFAULT_ROOM_ID,
  onChange: (members: Member[]) => void,
  onError?: (e: any) => void,
) {
  return roomCol(roomId)
    .orderBy('updatedAt', 'desc')
    .onSnapshot(
      snap => {
        const arr = snap.docs.map(d => ({
          id: d.id,
          ...(d.data() as any),
        })) as Member[];
        onChange(arr);
      },
      e => onError?.(e),
    );
}

/** Firestore 購読（Hook 版） */
export function useRoomMembers(roomId = DEFAULT_ROOM_ID) {
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = listenMembers(roomId, setMembers, e =>
      setError(`listen: ${e.message}`),
    );
    return unsub;
  }, [roomId]);

  return { members, error };
}

/** 位置のアップデート */
export async function updateMyLocation(
  lat: number,
  lon: number,
  roomId = DEFAULT_ROOM_ID,
  text?: string,
) {
  const uid = await ensureAnonAuth();
  await roomCol(roomId)
    .doc(uid)
    .set(
      {
        lat,
        lon,
        // text は入力されているときのみ上書き。未指定(undefined)なら既存値を保持
        ...(typeof text === 'string' ? { text } : {}),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

/** place のみ更新 */
export async function setMyPlace(place: string, roomId = DEFAULT_ROOM_ID) {
  const uid = await ensureAnonAuth();
  await roomCol(roomId).doc(uid).set({ place }, { merge: true });
}

/** text のみ更新 */
export async function setMyText(text: string, roomId = DEFAULT_ROOM_ID) {
  const uid = await ensureAnonAuth();
  await roomCol(roomId).doc(uid).set({ text }, { merge: true });
}

// ========= Storage helpers =========

/** 保存先パス（Storageルール準拠）: post/{uid}/latest.jpg */
export function storagePathForUserImage(uid: string) {
  return `post/${uid}/latest.jpg`;
}

/** 画像をStorageへアップロードしてURLを返す */
export async function uploadMyImage(localUri: string): Promise<{
  path: string;
  downloadURL: string;
}> {
  const uid = await ensureAnonAuth();
  // 念のためIDトークンを強制リフレッシュ（エミュレータの時刻ズレなど対策）
  try {
    await auth().currentUser?.getIdToken(true);
  } catch {}
  const path = storagePathForUserImage(uid);
  const ref = storage().ref(path);
  // contentType を簡易推定
  const lower = localUri.toLowerCase();
  const ext = lower.split('?')[0].split('#')[0].split('.').pop() || '';
  const mime =
    ext === 'png'
      ? 'image/png'
      : ext === 'webp'
      ? 'image/webp'
      : ext === 'heic' || ext === 'heif'
      ? 'image/heic'
      : 'image/jpeg';
  // RNFirebase Storageは file:// や content:// のURIに対応
  await ref.putFile(localUri, { contentType: mime } as any);
  const downloadURL = await ref.getDownloadURL();
  return { path, downloadURL };
}

/** 指定uid（未指定なら自分）の画像URLを取得。存在しない場合はnull */
export async function getUserImageUrl(uid?: string): Promise<string | null> {
  const id = uid ?? (await ensureAnonAuth());
  const ref = storage().ref(storagePathForUserImage(id));
  try {
    return await ref.getDownloadURL();
  } catch (e: any) {
    if (e?.code === 'storage/object-not-found') return null;
    throw e;
  }
}

// ===== Debug helpers =====
export function getFirebaseEnv() {
  const app = auth().app;
  const opts: any = (app as any).options || {};
  return {
    projectId: opts.projectId,
    appId: opts.appId,
    storageBucket: opts.storageBucket,
    apiKey: opts.apiKey ? '***' : undefined,
    authUid: auth().currentUser?.uid || null,
  };
}

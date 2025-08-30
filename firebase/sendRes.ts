import { useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

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
) {
  const uid = await ensureAnonAuth();
  await roomCol(roomId)
    .doc(uid)
    .set(
      { lat, lon, updatedAt: firestore.FieldValue.serverTimestamp() },
      { merge: true },
    );
}

/** place のみ更新 */
export async function setMyPlace(place: string, roomId = DEFAULT_ROOM_ID) {
  const uid = await ensureAnonAuth();
  await roomCol(roomId).doc(uid).set({ place }, { merge: true });
}

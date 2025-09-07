import firestore from '@react-native-firebase/firestore';
import { ensureAnonAuth } from './auth';

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

/** Firestore 購読（Hook 版） */
import { useEffect, useState } from 'react';
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

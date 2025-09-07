import firestore from '@react-native-firebase/firestore';
import { ensureAnonAuth } from './auth';

/** Data shape stored under rooms/{roomId}/members/{uid} */
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
/** Listen to room members ordered by updatedAt desc. */
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
/** Update own location (and optionally text) with serverTimestamp. */
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
/** Update only place field for current user. */
export async function setMyPlace(place: string, roomId = DEFAULT_ROOM_ID) {
  const uid = await ensureAnonAuth();
  await roomCol(roomId).doc(uid).set({ place }, { merge: true });
}

/** text のみ更新 */
/** Update only text field for current user. */
export async function setMyText(text: string, roomId = DEFAULT_ROOM_ID) {
  const uid = await ensureAnonAuth();
  await roomCol(roomId).doc(uid).set({ text }, { merge: true });
}

/** Firestore 購読（Hook 版） */
import { useEffect, useState } from 'react';
/** React hook that subscribes to members in a room. */
export function useRoomMembers(roomId = DEFAULT_ROOM_ID): {
  members: Member[];
  error: string | null;
} {
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

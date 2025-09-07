import firestore from '@react-native-firebase/firestore';
import { ensureAnonAuth } from './auth';

export type Encounter = {
  peerUid: string;
  roomId: string;
  place?: string | null;
  date: string; // YYYY-MM-DD (device local)
  timestamp?: any; // serverTimestamp
};

function usersCol() {
  return firestore().collection('users');
}

function todayKey(date = new Date()): string {
  // Device local date as YYYY-MM-DD
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Record an encounter with a peer and update counters on users/{uid}.
 * - users/{uid}/encounters/{YYYY-MM-DD}_{peerUid} ・・・1日1回までの遭遇ログ
 * - users/{uid}/peers/{peerUid} ・・・一度でも会ったことがある人のフラグ
 * - users/{uid} ドキュメントの todayConnections/totalConnections をトランザクションで更新
 */
export async function recordEncounter(
  peerUid: string,
  roomId: string,
  place?: string | null,
): Promise<void> {
  if (!peerUid) return;
  const me = await ensureAnonAuth();
  const date = todayKey();

  const userDocRef = usersCol().doc(me);
  const encounterDocId = `${date}_${peerUid}`;
  const encounterDocRef = userDocRef
    .collection('encounters')
    .doc(encounterDocId);
  const peerDocRef = userDocRef.collection('peers').doc(peerUid);

  await firestore().runTransaction(async t => {
    const [userSnap, encounterSnap, peerSnap] = await Promise.all([
      t.get(userDocRef),
      t.get(encounterDocRef),
      t.get(peerDocRef),
    ]);

    // exists may be a property (RNFirebase) or a method (web SDK style)
    const snapExists = (s: any): boolean =>
      typeof s?.exists === 'function' ? !!s.exists() : !!s?.exists;

    const userData = (userSnap?.data?.() as any) || {};
    const today = date;
    const lastDate: string | undefined = userData.lastEncounterDate;
    const curToday: number =
      typeof userData.todayConnections === 'number'
        ? userData.todayConnections
        : 0;
    const curTotal: number =
      typeof userData.totalConnections === 'number'
        ? userData.totalConnections
        : 0;

    const isFirstTodayWithPeer = !snapExists(encounterSnap);
    const isFirstEverWithPeer = !snapExists(peerSnap);

    const resetToday = lastDate !== today; // 日付切り替わり
    const nextToday =
      (resetToday ? 0 : curToday) + (isFirstTodayWithPeer ? 1 : 0);
    const nextTotal = curTotal + (isFirstEverWithPeer ? 1 : 0);

    // Update user counters
    t.set(
      userDocRef,
      {
        todayConnections: nextToday,
        totalConnections: nextTotal,
        lastEncounterDate: today,
      },
      { merge: true },
    );

    // Mark peer ever-met
    if (isFirstEverWithPeer) {
      t.set(
        peerDocRef,
        {
          firstMetAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    // Upsert today encounter log (idempotent per day+peer)
    t.set(
      encounterDocRef,
      {
        peerUid,
        roomId,
        place: place ?? null,
        date: today,
        timestamp: firestore.FieldValue.serverTimestamp(),
      } as Encounter,
      { merge: true },
    );
  });
}

/**
 * Utility: has met this peer ever (based on users/{uid}/peers/{peerUid}).
 */
export async function hasMetPeerEver(peerUid: string): Promise<boolean> {
  const me = await ensureAnonAuth();
  const snap = await usersCol().doc(me).collection('peers').doc(peerUid).get();
  const snapExists = (s: any): boolean =>
    typeof s?.exists === 'function' ? !!s.exists() : !!s?.exists;
  return snapExists(snap);
}

/**
 * Utility: has met this peer today (based on users/{uid}/encounters/{YYYY-MM-DD}_{peerUid}).
 */
export async function hasMetPeerToday(
  peerUid: string,
  date = todayKey(),
): Promise<boolean> {
  const me = await ensureAnonAuth();
  const id = `${date}_${peerUid}`;
  const snap = await usersCol().doc(me).collection('encounters').doc(id).get();
  const snapExists = (s: any): boolean =>
    typeof s?.exists === 'function' ? !!s.exists() : !!s?.exists;
  return snapExists(snap);
}

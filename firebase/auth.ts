import { useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';

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

export async function ensureAnonAuth(): Promise<string> {
  const cur = auth().currentUser;
  if (cur) return cur.uid;
  const cred = await auth().signInAnonymously();
  return cred.user.uid;
}

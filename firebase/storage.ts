import auth from '@react-native-firebase/auth';
import storage from '@react-native-firebase/storage';
import { ensureAnonAuth } from './auth';

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
  } catch (error) {
    console.warn('Failed to refresh ID token:', error);
  }
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
/** 指定 uid の画像URL。存在しない場合は null。 */
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

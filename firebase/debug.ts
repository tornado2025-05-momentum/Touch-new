import auth from '@react-native-firebase/auth';

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

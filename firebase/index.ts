// Central barrel for Firebase utilities. No behavior change.
export { useAuthUid, ensureAnonAuth } from './auth';
export {
  DEFAULT_ROOM_ID,
  type Member,
  listenMembers,
  useRoomMembers,
  updateMyLocation,
  setMyPlace,
  setMyText,
} from './members';
export {
  storagePathForUserImage,
  uploadMyImage,
  getUserImageUrl,
} from './storage';
export { getFirebaseEnv } from './debug';
export { recordEncounter, hasMetPeerEver, hasMetPeerToday } from './encounters';

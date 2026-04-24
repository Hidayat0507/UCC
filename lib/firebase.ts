import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isConfigured = Boolean(firebaseConfig.apiKey);

const app: FirebaseApp = isConfigured
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!)
  : (null as unknown as FirebaseApp);

const auth: Auth = isConfigured ? getAuth(app) : (null as unknown as Auth);
const db: Firestore = isConfigured ? getFirestore(app) : (null as unknown as Firestore);
const storage: FirebaseStorage = isConfigured ? getStorage(app) : (null as unknown as FirebaseStorage);

export { app, auth, db, storage };

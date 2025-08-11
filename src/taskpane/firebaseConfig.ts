import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword,
  User,
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  collection,
  deleteDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";

//FireBase Api Keys
const firebaseConfig = {
  apiKey: "AIzaSyCgrLHN7hPBDr00fWOFVf0mTlnE3phnolw",
  authDomain: "currency-converter-70b63.firebaseapp.com",
  projectId: "currency-converter-70b63",
  storageBucket: "currency-converter-70b63.firebasestorage.app",
  messagingSenderId: "408903853896",
  appId: "1:408903853896:web:9972890c000f73b27ff57d"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

//User Schema
export interface UserData {
  uid: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
}

//creates a default account for admin
export async function createDefaultAdmin() {
  try {
    const userCred = await createUserWithEmailAndPassword(auth, "admin@gmail.com", "Admin@123");
    await setDoc(doc(db, "users", userCred.user.uid), {
      email: userCred.user.email,
      name: "admin",
      isAdmin: true,
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.log("createDefaultAdmin warning:", err);
  }
}


export async function createUserRecord(user: User, name: string, isAdmin = false): Promise<void> {
  await setDoc(doc(db, "users", user.uid), {
    email: user.email,
    displayName: name,
    isAdmin,
    createdAt: serverTimestamp()
  });
}

export async function getUserData(uid: string): Promise<UserData | null> {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return {
      uid: docSnap.id,
      email: docSnap.data().email,
      displayName: docSnap.data().displayName,
      isAdmin: docSnap.data().isAdmin || false
    } as UserData;
  }
  return null;
}


export async function getUsersList(): Promise<UserData[]> {
  const usersSnapshot = await getDocs(collection(db, "users"));
  return usersSnapshot.docs.map(doc => ({
    uid: doc.id,
    email: doc.data().email,
    displayName: doc.data().displayName,
    isAdmin: doc.data().isAdmin || false
  } as UserData));
}

export async function removeUser(uid: string): Promise<void> {
  try {
    console.log(`Removing user document for ${uid}`);
    await deleteDoc(doc(db, "users", uid));
    console.log('User document removed successfully');
  } catch (error) {
    console.error('Error removing user document:', error);
    throw new Error('Failed to remove user document from database');
  }
}

export async function setAdminStatus(uid: string, isAdmin: boolean): Promise<void> {
  try {
    console.log(`Setting admin status to ${isAdmin} for user ${uid}`);
    await updateDoc(doc(db, "users", uid), {
      isAdmin,
      lastUpdated: serverTimestamp()
    });
    console.log('Admin status updated successfully');
  } catch (error) {
    console.error('Error updating admin status:', error);
    throw new Error('Failed to update admin status in database');
  }
}

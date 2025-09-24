// src/firebaseClient.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAownR9PzejEHB2nweED9HHl4IxCfVlygk",
  authDomain: "nhk-cleanroom.firebaseapp.com",
  projectId: "nhk-cleanroom",
  storageBucket: "nhk-cleanroom.firebasestorage.app",
  messagingSenderId: "171892754606",
  appId: "1:171892754606:web:6e4f196fb79ceed375853f",
  measurementId: "G-0SQJLPW23L"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// เรียกอันนี้ "ก่อน" ใช้ Firestore ทุกครั้ง (โหลด/บันทึก/ออกเลข)
export async function ensureAnonSignIn() {
  if (auth.currentUser) return auth.currentUser;
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) { unsub(); resolve(user); }
    });
    signInAnonymously(auth).catch((e) => { unsub(); reject(e); });
  });
}

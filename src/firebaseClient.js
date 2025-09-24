// src/firebaseClient.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// <<< แทนค่าด้านล่างด้วยของโปรเจกต์อิ๊ค >>>
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

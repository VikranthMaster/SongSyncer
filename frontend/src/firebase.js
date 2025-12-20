// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

//firebase init
// firebase login
// firebase deploy


const firebaseConfig = {
  apiKey: "AIzaSyD5xdMOXiR_lNermGb8nDYpgq7x_g2M4Mg",
  authDomain: "songsyncerv1.firebaseapp.com",
  projectId: "songsyncerv1",
  storageBucket: "songsyncerv1.firebasestorage.app",
  messagingSenderId: "1097401805594",
  appId: "1:1097401805594:web:db9baf4f66368969355aa3",
  measurementId: "G-Z7MR9386QN"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
export const storage = getStorage(app);

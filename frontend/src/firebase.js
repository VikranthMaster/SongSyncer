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
  apiKey: "AIzaSyBDmdBaM743x-wzC0I3RDIMNjlLwnqWgs8",
  authDomain: "songsync-a671a.firebaseapp.com",
  projectId: "songsync-a671a",
  storageBucket: "songsync-a671a.firebasestorage.app",
  messagingSenderId: "426419132614",
  appId: "1:426419132614:web:dab879897a2f042c199fc7",
  measurementId: "G-GDWS4SSSDT"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
export const storage = getStorage(app);

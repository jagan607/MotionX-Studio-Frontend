import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// PASTE YOUR CONFIG HERE
const firebaseConfig = {
    apiKey: "AIzaSyDRmKFLMuIsrOAb1HO7rsg1_iTSuF5iRXQ",
    authDomain: "motionx-studio.firebaseapp.com",
    projectId: "motionx-studio",
    storageBucket: "motionx-studio.firebasestorage.app",
    messagingSenderId: "280948415370",
    appId: "1:280948415370:web:09c24e4323ce21029ec673",
    measurementId: "G-2MB6CDD767"
  };

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDwciSNPBDzvPQ4vk4oJcxjWbQAqrKzFgk",
  authDomain: "icoa-azul.firebaseapp.com",
  projectId: "icoa-azul",
  storageBucket: "icoa-azul.firebasestorage.app",
  messagingSenderId: "759206159924",
  appId: "1:759206159924:web:7cfe7438514543cf82cc61"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };


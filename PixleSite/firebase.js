import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    fetchSignInMethodsForEmail,
    sendEmailVerification,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut,
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, doc, setDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

export const firebaseConfig = {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT_ID.appspot.com',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId: 'YOUR_APP_ID',
};

export {
    initializeApp,
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    fetchSignInMethodsForEmail,
    sendEmailVerification,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut,
    getFirestore,
    doc,
    setDoc,
    onSnapshot,
};

export function initializeFirebaseSession() {
    let auth = null;
    let db = null;
    let firebaseActive = false;

    try {
        if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
            const app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);
            firebaseActive = true;
        }
    } catch (e) {
        console.warn('Running in local mode without live Firebase credentials.');
    }

    return { auth, db, firebaseActive };
}

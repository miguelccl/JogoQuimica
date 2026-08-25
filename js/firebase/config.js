import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBAFHuTixMlhCkM88jOOT8s6FhRW-sxeCk",
    authDomain: "jogoquimica-1bb9f.firebaseapp.com",
    projectId: "jogoquimica-1bb9f",
    storageBucket: "jogoquimica-1bb9f.firebasestorage.app",
    messagingSenderId: "35817978106",
    appId: "1:35817978106:web:55d7c73497d6be1b2eb143",
    measurementId: "G-TDXDGT04X8"
};

export const appId = 'quimica-quiz-local';
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export async function loginAnonymous() {
    try {
        const cred = await signInAnonymously(auth);
        return cred.user;
    } catch (e) {
        console.error("Auth error", e);
        throw e;
    }
}

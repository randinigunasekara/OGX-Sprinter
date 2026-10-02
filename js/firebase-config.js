import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBWQ-2G5MYDCNnGOh2Gp9wzyLOThypbpmw',
  authDomain: 'campaign-sprinter.firebaseapp.com',
  projectId: 'campaign-sprinter',
  storageBucket: 'campaign-sprinter.firebasestorage.app',
  messagingSenderId: '152346724911',
  appId: '1:152346724911:web:3e6caa7993a5da26a094da',
  measurementId: 'G-DDRCTW27QH'
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export const firebaseStorage = getStorage(firebaseApp);
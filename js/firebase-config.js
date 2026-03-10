// Firebase 配置 — 复用 piggy-bank-17a7c 项目
const firebaseConfig = {
  apiKey: "AIzaSyBxKw-mXiNNJAIFbBgqSvSaHbCjgJUsSJ4",
  authDomain: "piggy-bank-17a7c.firebaseapp.com",
  projectId: "piggy-bank-17a7c",
  storageBucket: "piggy-bank-17a7c.firebasestorage.app",
  messagingSenderId: "581855837707",
  appId: "1:581855837707:web:e3d8e89e918fb8010b498e"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

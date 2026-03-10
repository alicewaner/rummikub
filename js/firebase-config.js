// Firebase 配置 — 复用 piggy-bank-17a7c 项目
const firebaseConfig = {
  apiKey: "AIzaSyBiXJvgiU556WYe77Cl8Yb5zO9Bw3GJKJs",
  authDomain: "piggy-bank-17a7c.firebaseapp.com",
  projectId: "piggy-bank-17a7c",
  storageBucket: "piggy-bank-17a7c.firebasestorage.app",
  messagingSenderId: "1012332227997",
  appId: "1:1012332227997:web:2788d48e43ff48b28ad374"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

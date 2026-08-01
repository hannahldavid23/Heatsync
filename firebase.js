import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { getDatabase, ref, onValue, set, remove, serverTimestamp, off, push } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBjVOVTPQp-WlT1BkUC44RFGj1fQk4lziQ",
  authDomain: "heatsync-12565.firebaseapp.com",
  databaseURL: "https://heatsync-12565-default-rtdb.firebaseio.com",
  projectId: "heatsync-12565",
  storageBucket: "heatsync-12565.firebasestorage.app",
  messagingSenderId: "562129460055",
  appId: "1:562129460055:web:8dec06711a1e695bb63c12"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
let activeStoreRef = null;
let activeStoreCallback = null;
let activeSettingsRef = null;
let activeSettingsCallback = null;
let connectedRef = null;
let connectedCallback = null;

function announceReady() {
  window.HeatSyncFirebase = {
    async signIn() {
      if (auth.currentUser) return auth.currentUser;
      const credential = await signInAnonymously(auth);
      return credential.user;
    },

    listenToStore(storeNumber, callback) {
      if (activeStoreRef && activeStoreCallback) off(activeStoreRef, "value", activeStoreCallback);
      activeStoreRef = ref(db, `stores/${storeNumber}/liveShift`);
      activeStoreCallback = snapshot => callback(snapshot.val());
      onValue(activeStoreRef, activeStoreCallback, error => {
        window.dispatchEvent(new CustomEvent("heatsync-cloud-error", { detail: error.message }));
      });
    },

    listenToStoreSettings(storeNumber, callback) {
      if (activeSettingsRef && activeSettingsCallback) off(activeSettingsRef, "value", activeSettingsCallback);
      activeSettingsRef = ref(db, `stores/${storeNumber}/settings`);
      activeSettingsCallback = snapshot => callback(snapshot.val());
      onValue(activeSettingsRef, activeSettingsCallback, error => {
        window.dispatchEvent(new CustomEvent("heatsync-cloud-error", { detail: error.message }));
      });
    },

    async saveStoreShift(storeNumber, payload) {
      await set(ref(db, `stores/${storeNumber}/liveShift`), { ...payload, updatedAt: serverTimestamp() });
    },

    async clearStoreShift(storeNumber) {
      await remove(ref(db, `stores/${storeNumber}/liveShift`));
    },

    async saveStoreSettings(storeNumber, settings) {
      await set(ref(db, `stores/${storeNumber}/settings`), { ...settings, updatedAt: serverTimestamp() });
    },

    async saveShiftSummary(storeNumber, summary) {
      await set(push(ref(db, `stores/${storeNumber}/shiftHistory`)), { ...summary, savedAt: serverTimestamp() });
    },

    watchConnection(callback) {
      if (connectedRef && connectedCallback) off(connectedRef, "value", connectedCallback);
      connectedRef = ref(db, ".info/connected");
      connectedCallback = snapshot => callback(snapshot.val() === true);
      onValue(connectedRef, connectedCallback);
    }
  };
  window.dispatchEvent(new Event("heatsync-firebase-ready"));
}

onAuthStateChanged(auth, () => announceReady(), error => {
  window.dispatchEvent(new CustomEvent("heatsync-cloud-error", { detail: error.message }));
});
announceReady();

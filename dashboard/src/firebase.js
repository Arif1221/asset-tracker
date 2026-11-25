import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// Values come from .env (see .env.example). Web config is not secret,
// but keeping it in .env makes it easy to switch projects.
const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FB_API_KEY,
  authDomain: env.VITE_FB_AUTH_DOMAIN,
  databaseURL: env.VITE_FB_DATABASE_URL,
  projectId: env.VITE_FB_PROJECT_ID,
  appId: env.VITE_FB_APP_ID,
};

// Without these the Firebase SDK throws while the page loads and the screen stays blank.
const missing = ["VITE_FB_API_KEY", "VITE_FB_DATABASE_URL", "VITE_FB_PROJECT_ID", "VITE_FB_APP_ID"].filter((k) => !env[k]);
export const configError = missing.length ? `Missing in .env: ${missing.join(", ")}` : null;
export const db = configError ? null : getDatabase(initializeApp(firebaseConfig));

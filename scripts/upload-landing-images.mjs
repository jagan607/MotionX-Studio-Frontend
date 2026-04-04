/**
 * One-time script to upload landing page screenshots to Firebase Storage.
 * Usage: node scripts/upload-landing-images.mjs
 */
import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const firebaseConfig = {
  apiKey: "AIzaSyDRmKFLMuIsrOAb1HO7rsg1_iTSuF5iRXQ",
  authDomain: "motionx-studio.firebaseapp.com",
  projectId: "motionx-studio",
  storageBucket: "motionx-studio.firebasestorage.app",
  messagingSenderId: "280948415370",
  appId: "1:280948415370:web:09c24e4323ce21029ec673",
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

// Source directory containing the screenshots from the conversation
const BRAIN_DIR = "/Users/jagan/.gemini/antigravity/brain/0d87fa9e-0b93-4691-85f9-ecd9946bb1b0";

// Map of timestamp-named files to descriptive names
const FILES = {
  "media__1775297056727.png": "landing/new-dashboard.png",
  "media__1775297077910.png": "landing/new-project-hub.png",
  "media__1775297105110.png": "landing/new-preproduction-canvas.png",
  "media__1775297142905.png": "landing/new-storyboard.png",
  "media__1775297241883.png": "landing/new-postproduction.png",
  "media__1775297327114.png": "landing/new-adr-terminal.png",
  "media__1775297350700.png": "landing/new-shot-config.png",
  "media__1775297387394.png": "landing/new-set-blueprint.png",
  "media__1775297401530.png": "landing/new-character-profile.png",
  "media__1775297426303.png": "landing/new-treatment.png",
};

async function upload() {
  const urls = {};

  for (const [localName, storagePath] of Object.entries(FILES)) {
    const localPath = resolve(BRAIN_DIR, localName);
    if (!existsSync(localPath)) {
      console.error(`  ❌ NOT FOUND: ${localPath}`);
      continue;
    }

    const data = readFileSync(localPath);
    const storageRef = ref(storage, storagePath);

    console.log(`  ⬆️  Uploading ${localName} → ${storagePath}  (${(data.length / 1024).toFixed(0)} KB)`);
    await uploadBytes(storageRef, data, { contentType: "image/png" });
    const url = await getDownloadURL(storageRef);
    urls[storagePath] = url;
    console.log(`  ✅ ${storagePath}`);
  }

  console.log("\n\n========== LANDING IMAGE URLS ==========\n");
  console.log(JSON.stringify(urls, null, 2));
  console.log("\n=========================================\n");

  process.exit(0);
}

upload().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    const projectId = '619df217-f7d5-46bc-8e72-edc41c2ce445';
    const moods = await db.collection('projects').doc(projectId).collection('moodboard_options').get();
    if (moods.empty) {
        console.log('No moodboards found for', projectId);
    } else {
        moods.forEach(m => console.log('Mood:', m.id, 'status:', m.data().status, 'image_url:', m.data().image_url));
    }
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

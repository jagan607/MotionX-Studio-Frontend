const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    const projectId = 'e511ed2d-bd7c-4e0a-b903-f44e72d7d8bf';
    const moods = await db.collection('projects').doc(projectId).collection('moodboard_options').get();
    moods.forEach(m => console.log('Mood:', m.id, JSON.stringify(m.data(), null, 2)));
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

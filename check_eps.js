const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    const projectId = '619df217-f7d5-46bc-8e72-edc41c2ce445';
    const episodes = await db.collection('projects').doc(projectId).collection('episodes').get();
    console.log('Project', projectId, 'has', episodes.size, 'episodes');
    episodes.forEach(e => console.log('Episode ID:', e.id));
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

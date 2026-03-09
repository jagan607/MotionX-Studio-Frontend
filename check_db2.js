const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    const projs = await db.collection('projects').get();
    for (const p of projs.docs) {
        const moods = await db.collection('projects').doc(p.id).collection('moodboard_options').get();
        if (!moods.empty) {
            console.log('Project:', p.id, 'has', moods.size, 'moodboards');
            moods.forEach(m => console.log('  Mood:', m.id, 'image_url:', m.data().image_url));

        }
    }
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

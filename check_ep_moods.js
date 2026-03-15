const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    const projectId = '619df217-f7d5-46bc-8e72-edc41c2ce446';
    const episodes = await db.collection('projects').doc(projectId).collection('episodes').get();

    for (const ep of episodes.docs) {
        console.log('Episode:', ep.id);
        const moods = await db.collection('projects').doc(projectId).collection('episodes').doc(ep.id).collection('moodboard_options').get();
        if (moods.empty) {
            console.log('  No moodboards under episode');
        } else {
            console.log('  Found', moods.size, 'moodboards under episode!');
            moods.forEach(m => console.log('    ', m.id, m.data().image_url));
        }
    }
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

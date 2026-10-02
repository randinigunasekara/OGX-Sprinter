import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'node:fs/promises';

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;

if (!projectId) {
  throw new Error('Set FIREBASE_PROJECT_ID to your Firebase project ID before seeding.');
}

initializeApp({ credential: applicationDefault(), projectId });

const scoringRulesUrl = new URL('../firebase/scoring-rules.json', import.meta.url);
const scoringRules = JSON.parse(await readFile(scoringRulesUrl, 'utf8'));
const db = getFirestore();
const batch = db.batch();

for (const rule of scoringRules) {
  const { id, ...data } = rule;
  batch.set(db.collection('scoringRules').doc(id), {
    ...data,
    active: true,
    updatedAt: FieldValue.serverTimestamp()
  });
}

await batch.commit();
console.log(`Seeded ${scoringRules.length} scoring rules into ${projectId}.`);
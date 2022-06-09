import { Firestore } from '@google-cloud/firestore';

export const db = new Firestore({
  projectId: 'struggle-for-greece-4f90c',
  keyFilename: './firestore_key.json',
});

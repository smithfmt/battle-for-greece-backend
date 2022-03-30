const Firestore = require('@google-cloud/firestore');

module.exports.db = new Firestore({
  projectId: 'struggle-for-greece-4f90c',
  keyFilename: './firestore_key.json',
});

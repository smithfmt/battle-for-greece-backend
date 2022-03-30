const admin = require("firebase-admin");
const { getDatabase } = require("firebase-admin/database");

const serviceAccount = require("./serviceAccount.json");

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://struggle-for-greece-4f90c-default-rtdb.firebaseio.com"
});

const base = getDatabase(app);
module.exports.base = base;
module.exports.admin = admin;
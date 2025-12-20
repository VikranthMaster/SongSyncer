const admin = require("firebase-admin");
const serviceAccount = require("./createServiceKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

module.exports = { db, auth, admin };

const { initializeApp, cert, getApps, getApp } = require("firebase-admin/app");

let app;

function initFirebaseAdmin() {
  if (getApps().length === 0) {
    try {
      const base64Account = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
      
      if (!base64Account || base64Account === 'replace_with_base64_encoded_service_account_json') {
         console.warn("WARNING: FIREBASE_SERVICE_ACCOUNT_BASE64 is not set or is using placeholder. Firebase Admin will NOT initialize properly.");
         return;
      }

      const serviceAccountJson = Buffer.from(base64Account, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(serviceAccountJson);

      app = initializeApp({
        credential: cert(serviceAccount),
      });
      
      console.log("Firebase Admin Initialized Successfully");
    } catch (error) {
      console.error("Failed to initialize Firebase Admin:", error);
    }
  } else {
    app = getApp();
  }
}

initFirebaseAdmin();

module.exports = { app };

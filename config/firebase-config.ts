import admin, { ServiceAccount } from "firebase-admin";
import { getDatabase, Database} from "firebase-admin/database";

import serviceAccount from "./serviceAccount.json";

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as ServiceAccount),
  databaseURL: "https://struggle-for-greece-4f90c-default-rtdb.firebaseio.com"
});

export const base:Database = getDatabase(app);
export default admin;
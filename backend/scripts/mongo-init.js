const storeDatabase = db.getSiblingDB("nihira_looms");
const username = process.env.MONGO_APP_USERNAME;
const password = process.env.MONGO_APP_PASSWORD;

if (!username || !password) {
  throw new Error("MONGO_APP_USERNAME and MONGO_APP_PASSWORD must be configured.");
}

storeDatabase.createUser({
  user: username,
  pwd: password,
  roles: [{ role: "readWrite", db: "nihira_looms" }],
});

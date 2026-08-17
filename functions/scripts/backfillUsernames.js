/*
 * One-time username backfill for existing users.
 *
 * Usage (from functions/):
 *   $env:FIREBASE_SERVICE_ACCOUNT_PATH="C:\path\to\serviceAccount.json"; node scripts\backfillUsernames.js
 *   or set GOOGLE_APPLICATION_CREDENTIALS instead.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const MAX_USERNAME_LENGTH = 12;
const BATCH_LIMIT = 400;

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!serviceAccountPath) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS.');
  process.exit(1);
}

const resolvedPath = path.resolve(serviceAccountPath);
const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const normalizeUsername = (value) => String(value || '').trim();

const isValidUsername = (value) => {
  const normalized = normalizeUsername(value);
  if (normalized.length < 1 || normalized.length > MAX_USERNAME_LENGTH) {
    return false;
  }
  return !normalized.includes('/');
};

const baseFromEmail = (email) => {
  const raw = String(email || '').split('@')[0] || 'user';
  const trimmed = raw.trim().replace(/\//g, '');
  return (trimmed || 'user').slice(0, MAX_USERNAME_LENGTH);
};

const buildCandidate = (base, suffix) => {
  if (!suffix) return base.slice(0, MAX_USERNAME_LENGTH);
  const trimmedBase = base.slice(0, Math.max(1, MAX_USERNAME_LENGTH - suffix.length - 1));
  return `${trimmedBase}_${suffix}`.slice(0, MAX_USERNAME_LENGTH);
};

const getUniqueUsername = (base, usernameMap) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const suffix = attempt === 0 ? '' : String(attempt + 1);
    const candidate = buildCandidate(base, suffix);
    if (!isValidUsername(candidate)) continue;
    if (!usernameMap.has(candidate)) return candidate;
  }

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const randomSuffix = String(Math.floor(1000 + Math.random() * 9000));
    const candidate = buildCandidate('user', randomSuffix);
    if (isValidUsername(candidate) && !usernameMap.has(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to generate a unique username.');
};

const commitBatch = async (batchOps) => {
  if (batchOps.length === 0) return;
  const batch = db.batch();
  batchOps.forEach((op) => op(batch));
  await batch.commit();
};

const backfillUsernames = async () => {
  console.log('Loading users...');
  const usersSnap = await db.collection('users').get();
  const userDocs = usersSnap.docs;
  const userMap = new Map();
  userDocs.forEach((doc) => userMap.set(doc.id, doc.data()));

  console.log('Loading username registry...');
  const usernamesSnap = await db.collection('usernames').get();
  const usernameMap = new Map();
  const registryDocs = usernamesSnap.docs;

  const batchOps = [];

  for (const doc of registryDocs) {
    const data = doc.data() || {};
    const uid = String(data.uid || '').trim();
    if (!uid || !userMap.has(uid)) {
      batchOps.push((batch) => batch.delete(doc.ref));
      console.log(`Deleting orphan username entry: ${doc.id}`);
      if (batchOps.length >= BATCH_LIMIT) {
        await commitBatch(batchOps.splice(0, batchOps.length));
      }
      continue;
    }
    usernameMap.set(doc.id, uid);
  }

  for (const userDoc of userDocs) {
    const uid = userDoc.id;
    const data = userDoc.data() || {};
    const email = data.email || '';
    const existingUsername = String(data.username || '').trim();
    const registryUid = usernameMap.get(existingUsername);
    let desiredUsername = existingUsername;
    let needsNew = false;

    if (!existingUsername || !isValidUsername(existingUsername)) {
      needsNew = true;
    } else if (registryUid && registryUid !== uid) {
      needsNew = true;
    }

    if (needsNew) {
      const base = baseFromEmail(email);
      desiredUsername = getUniqueUsername(base, usernameMap);
    }

    if (!desiredUsername) {
      continue;
    }

    if (existingUsername && existingUsername !== desiredUsername) {
      const oldRef = db.collection('usernames').doc(existingUsername);
      batchOps.push((batch) => batch.delete(oldRef));
      usernameMap.delete(existingUsername);
    }

    if (!usernameMap.has(desiredUsername)) {
      const usernameRef = db.collection('usernames').doc(desiredUsername);
      batchOps.push((batch) => batch.set(usernameRef, {
        uid,
        username: desiredUsername,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }));
      usernameMap.set(desiredUsername, uid);
    }

    if (existingUsername !== desiredUsername) {
      batchOps.push((batch) => batch.set(userDoc.ref, { username: desiredUsername }, { merge: true }));
      console.log(`Updated ${uid} -> ${desiredUsername}`);
    }

    if (batchOps.length >= BATCH_LIMIT) {
      await commitBatch(batchOps.splice(0, batchOps.length));
    }
  }

  await commitBatch(batchOps.splice(0, batchOps.length));
  console.log('Username backfill complete.');
};

backfillUsernames().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});

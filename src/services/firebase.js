// FESTIVAL CLOTHING POS - Firebase Authentication & Firestore Staff Approval Service
// Implements email-based staff approval workflow with local IndexedDB cache & offline resilience
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { getDB } from './db';

// Safely read Firebase configuration from environment with verified production fallback
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCdhEIUN67N6BXHn3JmLhRC2UxNqFhA90c',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'festival-a21f4.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'festival-a21f4',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'festival-a21f4.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '180763761780',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:180763761780:web:14ee9a26aad93e8a79c871',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-JLE6XGMZ0L',
};

export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    !firebaseConfig.apiKey.includes('your-') &&
    firebaseConfig.apiKey !== ''
  );
}

let firebaseApp = null;
let firebaseAuth = null;
let firestoreDb = null;

if (isFirebaseConfigured()) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    firebaseAuth = getAuth(firebaseApp);
    firestoreDb = getFirestore(firebaseApp);
  } catch (err) {
    console.warn('Firebase initialization notice:', err);
  }
}

// ----------------------------------------------------------------------------
// LOCAL INDEXEDDB STAFF CACHE HELPERS
// ----------------------------------------------------------------------------

const STAFF_LOCAL_KEY = 'wisdo_approved_staff_cache_v1';

export function getLocalStaffCache() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return [
      {
        email: 'leviraja670@gmail.com',
        role: 'ADMIN',
        status: 'active',
        approvedBy: 'SYSTEM_OWNER',
        approvedAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      },
    ];
  }
  try {
    const raw = localStorage.getItem(STAFF_LOCAL_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Staff cache read error:', e);
  }
  // Default store owner admin email
  return [
    {
      email: 'leviraja670@gmail.com',
      role: 'ADMIN',
      status: 'active',
      approvedBy: 'SYSTEM_OWNER',
      approvedAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    },
  ];
}

export function saveLocalStaffCache(staffList) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STAFF_LOCAL_KEY, JSON.stringify(staffList));
  } catch (e) {
    console.warn('Staff cache save error:', e);
  }
}

// ----------------------------------------------------------------------------
// STAFF ACCESS VERIFICATION (ADMIN vs CASHIER)
// ----------------------------------------------------------------------------

/**
 * Checks if a given email is approved to access the POS
 * Returns { isAllowed: boolean, role: 'ADMIN' | 'CASHIER' | null, reason: string }
 */
export async function verifyStaffAccess(email) {
  if (!email || typeof email !== 'string') {
    return { isAllowed: false, role: null, reason: 'Invalid email' };
  }

  const normalizedEmail = email.trim().toLowerCase();

  // 1. If Firebase Firestore is configured, check server-side collection first
  if (firestoreDb) {
    try {
      const staffDocRef = doc(firestoreDb, 'approved_staff', normalizedEmail);
      const snapshot = await getDoc(staffDocRef);

      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.status === 'revoked') {
          return {
            isAllowed: false,
            role: null,
            reason: 'Access Revoked: Your staff access has been disabled by the store administrator.',
          };
        }
        if (data.status === 'active') {
          // Update last login in background
          try {
            await updateDoc(staffDocRef, { lastLogin: new Date().toISOString() });
          } catch {
            // Non-blocking
          }
          return {
            isAllowed: true,
            role: data.role || 'CASHIER',
            reason: 'Authorized via Firestore',
          };
        }
      }
    } catch (err) {
      console.warn('Firestore staff check fallback to local cache:', err);
    }
  }

  // 2. Fallback to Local Cache / IndexedDB
  const localList = getLocalStaffCache();
  const match = localList.find((s) => s.email.toLowerCase() === normalizedEmail);

  if (match) {
    if (match.status === 'revoked') {
      return {
        isAllowed: false,
        role: null,
        reason: 'Access Revoked: Your staff access has been revoked by the store administrator.',
      };
    }
    return {
      isAllowed: true,
      role: match.role || 'CASHIER',
      reason: 'Authorized via Local Cache',
    };
  }

  return {
    isAllowed: false,
    role: null,
    reason: `Access Pending: Account (${normalizedEmail}) has not been approved by the store administrator.`,
  };
}

// ----------------------------------------------------------------------------
// STAFF MANAGEMENT (ADMIN ACTIONS)
// ----------------------------------------------------------------------------

/**
 * Retrieves the full list of approved staff from Firestore or local cache
 */
export async function getApprovedStaffList() {
  if (firestoreDb) {
    try {
      const colRef = collection(firestoreDb, 'approved_staff');
      const snapshot = await getDocs(colRef);
      const staffList = [];
      snapshot.forEach((docSnap) => {
        staffList.push({ id: docSnap.id, ...docSnap.data() });
      });
      if (staffList.length > 0) {
        saveLocalStaffCache(staffList);
        return staffList;
      }
    } catch (err) {
      console.warn('Error fetching staff from Firestore, using local cache:', err);
    }
  }

  return getLocalStaffCache();
}

/**
 * Approves or adds a staff member with role ADMIN or CASHIER
 */
export async function approveStaffMember(email, role = 'CASHIER', approvedBy = 'Admin') {
  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid staff email address.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const record = {
    email: normalizedEmail,
    role: role.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'CASHIER',
    status: 'active',
    approvedBy,
    approvedAt: new Date().toISOString(),
    lastLogin: null,
  };

  // 1. Save to Firestore if available
  if (firestoreDb) {
    try {
      const docRef = doc(firestoreDb, 'approved_staff', normalizedEmail);
      await setDoc(docRef, record, { merge: true });
    } catch (err) {
      console.warn('Firestore staff save error, saving locally:', err);
    }
  }

  // 2. Update local cache
  const localList = getLocalStaffCache().filter((s) => s.email.toLowerCase() !== normalizedEmail);
  localList.push(record);
  saveLocalStaffCache(localList);

  return record;
}

/**
 * Revokes a staff member's access
 */
export async function revokeStaffMember(email, revokedBy = 'Admin') {
  const normalizedEmail = email.trim().toLowerCase();

  if (firestoreDb) {
    try {
      const docRef = doc(firestoreDb, 'approved_staff', normalizedEmail);
      await updateDoc(docRef, {
        status: 'revoked',
        revokedBy,
        revokedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Firestore revoke error, updating locally:', err);
    }
  }

  const localList = getLocalStaffCache().map((s) => {
    if (s.email.toLowerCase() === normalizedEmail) {
      return { ...s, status: 'revoked', revokedBy, revokedAt: new Date().toISOString() };
    }
    return s;
  });
  saveLocalStaffCache(localList);
  return true;
}

/**
 * Changes a staff member's role (ADMIN <-> CASHIER)
 */
export async function changeStaffMemberRole(email, newRole, updatedBy = 'Admin') {
  const normalizedEmail = email.trim().toLowerCase();
  const roleUpper = newRole.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'CASHIER';

  if (firestoreDb) {
    try {
      const docRef = doc(firestoreDb, 'approved_staff', normalizedEmail);
      await updateDoc(docRef, {
        role: roleUpper,
        updatedBy,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Firestore role change error, updating locally:', err);
    }
  }

  const localList = getLocalStaffCache().map((s) => {
    if (s.email.toLowerCase() === normalizedEmail) {
      return { ...s, role: roleUpper, updatedBy, updatedAt: new Date().toISOString() };
    }
    return s;
  });
  saveLocalStaffCache(localList);
  return true;
}

// ----------------------------------------------------------------------------
// FIREBASE AUTHENTICATION FLOWS
// ----------------------------------------------------------------------------

/**
 * Recursively cleans an object for Firestore to avoid undefined field errors
 */
function sanitizeForFirestore(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);

  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = (typeof val === 'object' && val !== null) ? sanitizeForFirestore(val) : val;
    }
  }
  return clean;
}

/**
 * Synchronizes local bills with Firestore sales_bills collection
 */
export async function syncBillsWithFirestore(localBills) {
  if (!firestoreDb) {
    return { syncedCount: 0, remoteBills: [], error: new Error('Firestore not initialized') };
  }

  let syncError = null;
  let successfulUploads = 0;

  // 1. Upload un-synced local bills
  const unSynced = (localBills || []).filter((b) => b.syncStatus !== 'synced');
  for (const b of unSynced) {
    try {
      const billKey = b.billNumber || b.id;
      const docRef = doc(firestoreDb, 'sales_bills', billKey);
      const cleanData = sanitizeForFirestore({
        ...b,
        syncStatus: 'synced',
        syncedAt: new Date().toISOString(),
      });
      await setDoc(docRef, cleanData, { merge: true });
      successfulUploads++;
    } catch (e) {
      console.warn('Failed to upload bill to Firestore:', b.billNumber, e);
      syncError = e;
    }
  }

  // 2. Fetch all bills from Firestore
  const remoteBills = [];
  try {
    const snapshot = await getDocs(collection(firestoreDb, 'sales_bills'));
    snapshot.forEach((docSnap) => {
      remoteBills.push(docSnap.data());
    });
  } catch (err) {
    console.warn('Failed to fetch bills from Firestore:', err);
    syncError = err;
  }

  return {
    syncedCount: successfulUploads,
    remoteBills,
    error: syncError,
  };
}

/**
 * Subscribes to real-time sales_bills updates from Firestore
 * Whenever any device (PC or mobile) creates or cancels a bill,
 * this listener fires immediately!
 */
export function subscribeFirestoreBills(onBillsUpdated, onError) {
  if (!firestoreDb) return () => {};

  try {
    const billsCol = collection(firestoreDb, 'sales_bills');
    return onSnapshot(
      billsCol,
      (snapshot) => {
        const bills = [];
        snapshot.forEach((docSnap) => {
          bills.push(docSnap.data());
        });
        onBillsUpdated(bills);
      },
      (err) => {
        console.warn('Firestore real-time listener notice:', err);
        if (typeof onError === 'function') {
          onError(err);
        }
      }
    );
  } catch (err) {
    console.warn('Failed to attach Firestore live listener:', err);
    if (typeof onError === 'function') {
      onError(err);
    }
    return () => {};
  }
}

/**
 * Uploads a single bill directly to Firestore
 */
export async function uploadSingleBillToFirestore(bill) {
  if (!firestoreDb) return { success: false, reason: 'Firestore not configured' };
  try {
    const billKey = bill.billNumber || bill.id;
    const docRef = doc(firestoreDb, 'sales_bills', billKey);
    const cleanData = sanitizeForFirestore({
      ...bill,
      syncStatus: 'synced',
      syncedAt: new Date().toISOString(),
    });
    await setDoc(docRef, cleanData, { merge: true });
    return { success: true, billKey };
  } catch (err) {
    console.warn('Direct upload error for bill:', bill?.billNumber, err);
    return { success: false, error: err.message };
  }
}

/**
 * Updates an existing bill document in Firestore
 */
export async function updateBillInFirestore(billKey, updates) {
  if (!firestoreDb) return false;
  try {
    const docRef = doc(firestoreDb, 'sales_bills', billKey);
    const cleanUpdates = sanitizeForFirestore(updates);
    await updateDoc(docRef, cleanUpdates);
    return true;
  } catch (err) {
    console.warn('Firestore update bill error:', billKey, err);
    return false;
  }
}

/**
 * Deletes a bill document from Firestore
 */
export async function deleteBillFromFirestore(billKey) {
  if (!firestoreDb) return false;
  try {
    const docRef = doc(firestoreDb, 'sales_bills', billKey);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn('Firestore delete bill error:', billKey, err);
    return false;
  }
}

export async function signInWithGoogle() {
  if (!firebaseAuth) {
    throw new Error('Firebase Authentication is not configured. Please add Firebase project keys in environment.');
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(firebaseAuth, provider);
  return result.user;
}

export async function signOutStaff() {
  if (firebaseAuth) {
    await signOut(firebaseAuth);
  }
}

export function subscribeAuthState(callback) {
  if (!firebaseAuth) {
    // Return no-op unsubscription when Firebase is unconfigured
    return () => {};
  }
  return onAuthStateChanged(firebaseAuth, callback);
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db, auth, isConfigPlaceholder, OperationType, handleFirestoreError } from "./firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  onSnapshot, 
  updateDoc, 
  deleteDoc,
  writeBatch
} from "firebase/firestore";

/**
 * Checks if a Firestore collection is empty and populates it with default values if true.
 */
export async function bootstrapCollectionIfEmpty<T extends { id?: string | number }>(
  collectionName: string,
  defaultItems: T[]
) {
  if (!db || isConfigPlaceholder) return;
  try {
    const colRef = collection(db, collectionName);
    const snapshot = await getDocs(colRef);
    
    if (snapshot.empty) {
      console.log(`Bootstrapping Firestore collection '${collectionName}' with ${defaultItems.length} items...`);
      const batch = writeBatch(db);
      
      defaultItems.forEach((item) => {
        // Formulate a clean document key. Use 'protocolo' for manifestacoes, 'email' for usuarios, or custom ID
        let docId = String(item.id);
        if ('protocolo' in item) {
          docId = String((item as any).protocolo);
        } else if ('email' in item) {
          docId = String((item as any).email).toLowerCase();
        } else if ('docId' in item) {
          docId = String((item as any).docId);
        }
        
        const docRef = doc(db, collectionName, docId);
        batch.set(docRef, item);
      });
      
      await batch.commit();
      console.log(`Successfully bootstrapped ${collectionName}.`);
    }
  } catch (error) {
    console.warn(`Error bootstrapping ${collectionName}:`, error);
  }
}

/**
 * Subscribes to real-time updates for a specific collection.
 */
export function subscribeToCollection<T>(
  collectionName: string,
  setLocalState: (data: T[]) => void,
  fallbackData: T[],
  keySelector: (item: T) => string | number
) {
  if (!db || isConfigPlaceholder) {
    // If Firebase is not configured, load from localStorage if exists, or fallback
    const saved = localStorage.getItem(`local_${collectionName}`);
    if (saved) {
      try {
        setLocalState(JSON.parse(saved));
      } catch (e) {
        setLocalState(fallbackData);
      }
    } else {
      setLocalState(fallbackData);
    }
    return () => {};
  }

  const colRef = collection(db, collectionName);
  
  const unsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const items: T[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ ...docSnap.data() } as T);
      });
      
      // Sort or preserve original state order if matching
      setLocalState(items);
      localStorage.setItem(`local_${collectionName}`, JSON.stringify(items));
    },
    (err) => {
      console.warn(`Subscription error in ${collectionName}:`, err);
      try {
        handleFirestoreError(err, OperationType.LIST, collectionName);
      } catch (e) {
        // Silently keep working with previous cache
      }
    }
  );

  return unsubscribe;
}

/**
 * Helper to write or update a document in a collection.
 */
export async function saveDocument(collectionName: string, docId: string, data: any) {
  // Update local cache first
  const saved = localStorage.getItem(`local_${collectionName}`);
  if (saved) {
    try {
      const items = JSON.parse(saved);
      const index = items.findIndex((i: any) => {
        if ('protocolo' in i && 'protocolo' in data) return String(i.protocolo) === String(data.protocolo);
        if ('email' in i && 'email' in data) return String(i.email).toLowerCase() === String(data.email).toLowerCase();
        return String(i.id) === String(docId);
      });
      if (index > -1) {
        items[index] = { ...items[index], ...data };
      } else {
        items.push(data);
      }
      localStorage.setItem(`local_${collectionName}`, JSON.stringify(items));
    } catch (e) {}
  }

  // Write to Firebase
  if (!db || isConfigPlaceholder) return;
  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionName}/${docId}`);
  }
}

/**
 * Helper to delete a document in a collection.
 */
export async function deleteDocument(collectionName: string, docId: string) {
  // Update local cache first
  const saved = localStorage.getItem(`local_${collectionName}`);
  if (saved) {
    try {
      let items = JSON.parse(saved);
      items = items.filter((i: any) => {
        if ('protocolo' in i) return String(i.protocolo) !== String(docId);
        if ('email' in i) return String(i.email).toLowerCase() !== String(docId).toLowerCase();
        return String(i.id) !== String(docId);
      });
      localStorage.setItem(`local_${collectionName}`, JSON.stringify(items));
    } catch (e) {}
  }

  // Write to Firebase
  if (!db || isConfigPlaceholder) return;
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${docId}`);
  }
}

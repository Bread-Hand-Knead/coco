import { auth, db } from './firebase';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';

// --- Firebase Error Handling ---

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Offline Sync Queue Helpers ---
export interface SyncTask {
  id: string;
  type: 'setDoc' | 'deleteDoc';
  path: string;
  idDoc: string;
  data?: any;
  timestamp: number;
}

export const getSyncQueue = (): SyncTask[] => {
  try {
    const raw = localStorage.getItem('coco_sync_queue');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

export const saveSyncQueue = (queue: SyncTask[]) => {
  try {
    localStorage.setItem('coco_sync_queue', JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to save sync queue', e);
  }
};

export const enqueueSyncTask = (task: Omit<SyncTask, 'id' | 'timestamp'>) => {
  const queue = getSyncQueue();
  const filtered = queue.filter(item => !(item.path === task.path && item.idDoc === task.idDoc));
  filtered.push({
    ...task,
    id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
  });
  saveSyncQueue(filtered);
};

export const processSyncQueue = async (uid: string) => {
  if (!navigator.onLine || !uid) return;
  const queue = getSyncQueue();
  if (queue.length === 0) return;

  const remaining: SyncTask[] = [];
  for (const task of queue) {
    try {
      if (task.type === 'setDoc') {
        const sanitizedData = cleanData(task.data);
        await setDoc(doc(db, 'users', uid, task.path, task.idDoc), sanitizedData);
      } else if (task.type === 'deleteDoc') {
        await deleteDoc(doc(db, 'users', uid, task.path, task.idDoc));
      }
    } catch (err) {
      console.error('Sync queue task failed:', task, err);
      remaining.push(task);
    }
  }
  saveSyncQueue(remaining);
};

// Firestore sync functions
export const cleanData = (obj: any) => {
  if (obj === null || typeof obj !== 'object') return obj;
  const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
  Object.keys(newObj).forEach(key => {
    if (newObj[key] === undefined) {
      delete newObj[key];
    } else if (newObj[key] !== null && typeof newObj[key] === 'object') {
      newObj[key] = cleanData(newObj[key]);
    }
  });
  return newObj;
};

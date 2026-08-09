import { useCallback, useEffect, useRef, useState } from 'react';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

const RECIPE_CACHE_KEY = 'recipe-book-pwa-data';
const CATEGORY_CACHE_KEY = 'recipe-book-pwa-categories';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDvCYpiU-vGpNdz0uMQ5atGy_EZUvcNCp0',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'recipe-pwa-cloud.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'recipe-pwa-cloud',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'recipe-pwa-cloud.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '511752663776',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:511752663776:web:0e61f550ae6583c7a41685',
};

export const cloudConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
);

let auth = null;
let db = null;

if (cloudConfigured) {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  setPersistence(auth, browserLocalPersistence).catch(() => {});
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
}

function readCache(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return { value: fallback, exists: false };
    return { value: JSON.parse(raw), exists: true };
  } catch {
    return { value: fallback, exists: false };
  }
}

function storeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The Firebase cache remains available when browser storage is restricted.
  }
}

function cleanRecipe(recipe) {
  return Object.fromEntries(Object.entries(recipe).filter(([, value]) => value !== undefined));
}

function compressDataImage(dataUrl) {
  if (!dataUrl?.startsWith('data:image/') || dataUrl.length <= 520_000) {
    return Promise.resolve(dataUrl);
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.onerror = () => resolve(dataUrl);
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const maxSide = 1200;
      let scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      let result = dataUrl;

      while (scale >= 0.28) {
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        result = canvas.toDataURL('image/jpeg', scale > 0.6 ? 0.78 : 0.68);
        if (result.length <= 520_000) break;
        scale *= 0.8;
      }
      resolve(result);
    };
    image.src = dataUrl;
  });
}

async function prepareRecipeForCloud(recipe) {
  const clean = cleanRecipe(recipe);
  if (!clean.createdAt) clean.createdAt = Date.now();
  if (clean.image) clean.image = await compressDataImage(clean.image);
  return clean;
}

function sortRecipes(recipes) {
  return [...recipes].sort((left, right) => {
    const byCreatedAt = Number(right.createdAt || 0) - Number(left.createdAt || 0);
    return byCreatedAt || String(left.id).localeCompare(String(right.id));
  });
}

function authMessage(error) {
  const messages = {
    'auth/email-already-in-use': '???? ????? ??? ???????????????. ?????????? ?????.',
    'auth/invalid-credential': '???????? email ??? ??????.',
    'auth/invalid-email': '????????? ????? ??????????? ?????.',
    'auth/missing-password': '??????? ??????.',
    'auth/weak-password': '?????? ?????? ????????? ?? ????? 6 ????????.',
    'auth/too-many-requests': '??????? ????? ???????. ????????? ??????? ? ?????????? ?????.',
    'auth/network-request-failed': '??? ?????????? ? ???????. ????????? ????????.',
  };
  return messages[error?.code] || '?? ??????? ???????????? ? ??????. ?????????? ??? ???.';
}

async function commitRecipeDiff(uid, previous, next) {
  const previousById = new Map(previous.map((recipe) => [recipe.id, recipe]));
  const nextById = new Map(next.map((recipe) => [recipe.id, recipe]));
  const batch = writeBatch(db);
  let operations = 0;

  const changedRecipes = next.filter((recipe) => {
    const oldRecipe = previousById.get(recipe.id);
    return !oldRecipe || JSON.stringify(oldRecipe) !== JSON.stringify(recipe);
  });
  const preparedRecipes = await Promise.all(changedRecipes.map(prepareRecipeForCloud));

  for (const recipe of preparedRecipes) {
      batch.set(doc(db, 'users', uid, 'recipes', recipe.id), {
        ...recipe,
        updatedAt: serverTimestamp(),
      });
      operations += 1;
  }

  for (const recipe of previous) {
    if (!nextById.has(recipe.id)) {
      batch.delete(doc(db, 'users', uid, 'recipes', recipe.id));
      operations += 1;
    }
  }

  if (operations > 0) await batch.commit();
}

export function useCloudRecipeBook(initialRecipes, defaultCategories) {
  const recipeBootstrap = useRef(null);
  const categoryBootstrap = useRef(null);
  if (!recipeBootstrap.current) recipeBootstrap.current = readCache(RECIPE_CACHE_KEY, initialRecipes);
  if (!categoryBootstrap.current) categoryBootstrap.current = readCache(CATEGORY_CACHE_KEY, defaultCategories);

  const [recipes, setRecipesState] = useState(recipeBootstrap.current.value);
  const [categories, setCategoriesState] = useState(categoryBootstrap.current.value);
  const [user, setUser] = useState(null);
  const [authResolved, setAuthResolved] = useState(!cloudConfigured);
  const [cloudReady, setCloudReady] = useState(false);
  const [status, setStatus] = useState(cloudConfigured ? 'connecting' : 'local');
  const [error, setError] = useState('');

  const recipesRef = useRef(recipes);
  const categoriesRef = useRef(categories);
  const userRef = useRef(null);
  const hadCloudSessionRef = useRef(false);
  const cloudReadyRef = useRef(false);
  const importLocalRef = useRef(recipeBootstrap.current.exists || categoryBootstrap.current.exists);

  useEffect(() => {
    recipesRef.current = recipes;
    storeCache(RECIPE_CACHE_KEY, recipes);
  }, [recipes]);

  useEffect(() => {
    categoriesRef.current = categories;
    storeCache(CATEGORY_CACHE_KEY, categories);
  }, [categories]);

  useEffect(() => {
    if (!cloudConfigured) return undefined;

    let unsubscribeRecipes = null;
    let unsubscribeSettings = null;
    let cancelled = false;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      unsubscribeRecipes?.();
      unsubscribeSettings?.();
      unsubscribeRecipes = null;
      unsubscribeSettings = null;
      const previousUser = userRef.current;
      userRef.current = currentUser;
      setUser(currentUser);
      setAuthResolved(true);
      setError('');

      if (!currentUser) {
        if (hadCloudSessionRef.current) {
          recipesRef.current = initialRecipes;
          categoriesRef.current = defaultCategories;
          importLocalRef.current = false;
          setRecipesState(initialRecipes);
          setCategoriesState(defaultCategories);
        }
        cloudReadyRef.current = false;
        setCloudReady(false);
        setStatus('local');
        return;
      }

      if (previousUser && previousUser.uid !== currentUser.uid) {
        recipesRef.current = [];
        categoriesRef.current = defaultCategories;
        importLocalRef.current = false;
        setRecipesState([]);
        setCategoriesState(defaultCategories);
      }
      hadCloudSessionRef.current = true;
      setStatus('connecting');
      const settingsRef = doc(db, 'users', currentUser.uid, 'settings', 'book');
      const recipesCollection = collection(db, 'users', currentUser.uid, 'recipes');

      try {
        const [settingsSnapshot, remoteRecipesSnapshot] = await Promise.all([
          getDoc(settingsRef),
          getDocs(recipesCollection),
        ]);
        if (cancelled || userRef.current?.uid !== currentUser.uid) return;

        const remoteRecipes = remoteRecipesSnapshot.docs.map((item) => ({ id: item.id, ...item.data(), updatedAt: undefined }));
        const remoteIds = new Set(remoteRecipes.map((recipe) => recipe.id));
        const settings = settingsSnapshot.data();
        const isNewBook = !settingsSnapshot.exists() || settings?.initialized !== true;
        const localOnlyRecipes = importLocalRef.current
          ? recipesRef.current.filter((recipe) => !remoteIds.has(recipe.id))
          : [];
        const mergedCategories = Array.from(new Set([
          ...(settings?.categories || []),
          ...(importLocalRef.current ? categoriesRef.current : []),
        ]));

        if (isNewBook || localOnlyRecipes.length > 0 || mergedCategories.length !== (settings?.categories || []).length) {
          const batch = writeBatch(db);
          const recipesToImport = await Promise.all(
            (isNewBook ? recipesRef.current : localOnlyRecipes).map((recipe, index) => (
              prepareRecipeForCloud({
                ...recipe,
                createdAt: recipe.createdAt || Date.now() - index,
              })
            )),
          );
          for (const recipe of recipesToImport) {
            batch.set(doc(db, 'users', currentUser.uid, 'recipes', recipe.id), {
              ...recipe,
              updatedAt: serverTimestamp(),
            });
          }
          batch.set(settingsRef, {
            initialized: true,
            categories: mergedCategories.length ? mergedCategories : defaultCategories,
            updatedAt: serverTimestamp(),
          }, { merge: true });
          await batch.commit();
        }

        importLocalRef.current = false;
        unsubscribeRecipes = onSnapshot(
          recipesCollection,
          { includeMetadataChanges: true },
          (snapshot) => {
            const nextRecipes = sortRecipes(snapshot.docs.map((item) => {
              const { updatedAt: _updatedAt, ...recipe } = item.data();
              return { id: item.id, ...recipe };
            }));
            recipesRef.current = nextRecipes;
            setRecipesState(nextRecipes);
            setStatus(snapshot.metadata.fromCache ? 'offline' : 'synced');
          },
          () => {
            setStatus('error');
            setError('?? ??????? ????????? ??????? ?? ??????.');
          },
        );

        unsubscribeSettings = onSnapshot(settingsRef, (snapshot) => {
          const nextCategories = snapshot.data()?.categories;
          if (Array.isArray(nextCategories)) {
            categoriesRef.current = nextCategories;
            setCategoriesState(nextCategories);
          }
        });

        cloudReadyRef.current = true;
        setCloudReady(true);
      } catch (bootstrapError) {
        cloudReadyRef.current = false;
        setCloudReady(false);
        setStatus('error');
        setError(bootstrapError?.message || '?? ??????? ????????? ???????? ?????????????.');
      }
    });

    return () => {
      cancelled = true;
      unsubscribeAuth();
      unsubscribeRecipes?.();
      unsubscribeSettings?.();
    };
  }, [defaultCategories, initialRecipes]);

  const setRecipes = useCallback((update) => {
    const previous = recipesRef.current;
    const next = typeof update === 'function' ? update(previous) : update;
    recipesRef.current = next;
    importLocalRef.current = true;
    setRecipesState(next);

    if (cloudReadyRef.current && userRef.current) {
      setStatus('syncing');
      commitRecipeDiff(userRef.current.uid, previous, next)
        .then(() => setStatus(navigator.onLine ? 'synced' : 'offline'))
        .catch(() => {
          setStatus('error');
          setError('????????? ????????? ?? ??????????, ?? ???? ?? ?????????? ? ??????.');
        });
    }
  }, []);

  const setCategories = useCallback((update) => {
    const previous = categoriesRef.current;
    const next = typeof update === 'function' ? update(previous) : update;
    categoriesRef.current = next;
    importLocalRef.current = true;
    setCategoriesState(next);

    if (cloudReadyRef.current && userRef.current) {
      setStatus('syncing');
      setDoc(doc(db, 'users', userRef.current.uid, 'settings', 'book'), {
        initialized: true,
        categories: next,
        updatedAt: serverTimestamp(),
      }, { merge: true })
        .then(() => setStatus(navigator.onLine ? 'synced' : 'offline'))
        .catch(() => {
          setStatus('error');
          setError('????????? ????????? ?? ??????????, ?? ???? ?? ?????????? ? ??????.');
        });
    }
  }, []);

  const runAuth = useCallback(async (action) => {
    setError('');
    try {
      return await action();
    } catch (authError) {
      const message = authMessage(authError);
      setError(message);
      throw new Error(message);
    }
  }, []);

  const signIn = useCallback((email, password) => runAuth(() => signInWithEmailAndPassword(auth, email, password)), [runAuth]);
  const signUp = useCallback((email, password) => runAuth(() => createUserWithEmailAndPassword(auth, email, password)), [runAuth]);
  const logOut = useCallback(() => signOut(auth), []);
  const resetPassword = useCallback((email) => runAuth(() => sendPasswordResetEmail(auth, email)), [runAuth]);

  return {
    recipes,
    setRecipes,
    categories,
    setCategories,
    user,
    authResolved,
    cloudReady,
    configured: cloudConfigured,
    status,
    error,
    signIn,
    signUp,
    logOut,
    resetPassword,
  };
}

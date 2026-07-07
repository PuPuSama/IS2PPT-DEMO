import { STORAGE_KEY_MIGRATIONS } from './storageKeys';

const copyValue = (storage: Storage, oldKey: string, nextKey: string) => {
  const value = storage.getItem(oldKey);
  if (value !== null && storage.getItem(nextKey) === null) {
    storage.setItem(nextKey, value);
  }
};

const migrateStorageKeys = (
  storage: Storage,
  migrations: readonly (readonly [string, string])[]
) => {
  migrations.forEach(([oldKey, nextKey]) => copyValue(storage, oldKey, nextKey));
};

const migrateStoragePrefixes = (
  storage: Storage,
  migrations: readonly (readonly [string, string])[]
) => {
  migrations.forEach(([oldPrefix, nextPrefix]) => {
    for (let index = 0; index < storage.length; index += 1) {
      const oldKey = storage.key(index);
      if (!oldKey?.startsWith(oldPrefix)) continue;

      const suffix = oldKey.slice(oldPrefix.length);
      copyValue(storage, oldKey, `${nextPrefix}${suffix}`);
    }
  });
};

export const migrateAppStorage = () => {
  if (typeof window === 'undefined') return;

  migrateStorageKeys(window.localStorage, STORAGE_KEY_MIGRATIONS.localStorage);
  migrateStorageKeys(window.sessionStorage, STORAGE_KEY_MIGRATIONS.sessionStorage);
  migrateStoragePrefixes(window.localStorage, STORAGE_KEY_MIGRATIONS.localStoragePrefixes);
};


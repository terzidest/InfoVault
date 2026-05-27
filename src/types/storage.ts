export type StorageType = 'credential' | 'note' | 'personalInfo';

export interface StoredItemMetadata {
  lastModified: string;
  type: StorageType;
}

export interface StoredItem<T> extends StoredItemMetadata {
  key: string;
  data: T;
}

import * as SecureStore from 'expo-secure-store';

/**
 * Save data to secure storage
 * @param {string} key - Unique identifier for the data
 * @param {any} value - Data to store (will be JSON stringified)
 * @param {string} type - Category type for organizing keys
 * @returns {Promise<void>}
 */
export const saveToSecureStore = async (key, value, type) => {
  try {
    // Convert value to string if needed
    const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);
    
    // Store the value
    await SecureStore.setItemAsync(key, valueToStore);
    
    // Track keys by category
    let keys = await SecureStore.getItemAsync(type + 'Keys') || '[]';
    let parsedKeys = JSON.parse(keys);
    
    if (!parsedKeys.includes(key)) {
      parsedKeys.push(key);
      await SecureStore.setItemAsync(type + 'Keys', JSON.stringify(parsedKeys));
    }
    
    // Update the last modified timestamp
    const metadata = {
      lastModified: new Date().toISOString(),
      type: type
    };
    await SecureStore.setItemAsync(key + '_metadata', JSON.stringify(metadata));
    
    return true;
  } catch (error) {
    console.error('Error saving to SecureStore', error);
    throw error;
  }
};

/**
 * Retrieve data from secure storage
 * @param {string} key - Unique identifier for the data
 * @param {boolean} parseJson - Whether to parse the result as JSON
 * @returns {Promise<any>} Retrieved data
 */
export const getFromSecureStore = async (key, parseJson = true) => {
  try {
    const value = await SecureStore.getItemAsync(key);
    
    if (!value) return null;
    
    return parseJson ? JSON.parse(value) : value;
  } catch (error) {
    console.error('Error reading from SecureStore', error);
    throw error;
  }
};

/**
 * Delete data from secure storage
 * @param {string} key - Unique identifier for the data
 * @param {string} type - Category type for organizing keys
 * @returns {Promise<boolean>} Success status
 */
export const deleteFromSecureStore = async (key, type) => {
  try {
    // Remove the item
    await SecureStore.deleteItemAsync(key);
    
    // Also remove metadata
    await SecureStore.deleteItemAsync(key + '_metadata');
    
    // Update the category keys
    let keys = await SecureStore.getItemAsync(type + 'Keys') || '[]';
    let parsedKeys = JSON.parse(keys);
    const updatedKeys = parsedKeys.filter(k => k !== key);
    await SecureStore.setItemAsync(type + 'Keys', JSON.stringify(updatedKeys));
    
    return true;
  } catch (error) {
    console.error('Error deleting from SecureStore', error);
    throw error;
  }
};

/**
 * Get all keys for a specific category
 * @param {string} type - Category type
 * @returns {Promise<string[]>} Array of keys
 */
export const getKeysByType = async (type) => {
  try {
    const keys = await SecureStore.getItemAsync(type + 'Keys') || '[]';
    return JSON.parse(keys);
  } catch (error) {
    console.error('Error getting keys by type', error);
    return [];
  }
};

/**
 * Get all items for a specific category
 * @param {string} type - Category type
 * @returns {Promise<Array>} Array of items with their metadata
 */
export const getAllItemsByType = async (type) => {
  try {
    const keys = await getKeysByType(type);
    const items = [];
    
    for (const key of keys) {
      const item = await getFromSecureStore(key);
      const metadata = await getFromSecureStore(key + '_metadata');
      
      if (item && metadata) {
        items.push({
          key,
          data: item,
          ...metadata
        });
      }
    }
    
    return items;
  } catch (error) {
    console.error('Error getting all items by type', error);
    return [];
  }
};

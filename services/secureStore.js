import * as SecureStore from 'expo-secure-store';

export const saveToSecureStore = async (key, value, type) => {
  try {
    await SecureStore.setItemAsync(key, value);
    let keys = await SecureStore.getItemAsync(type + 'Keys') || '[]';
    let parsedKeys = JSON.parse(keys);
    if (!parsedKeys.includes(key)) {
      parsedKeys.push(key);
      await SecureStore.setItemAsync(type + 'Keys', JSON.stringify(parsedKeys));
    }
    console.log(`Saved ${key} to ${type}Keys`);
  } catch (error) {
    console.error('Error saving to SecureStore', error);
  }
};

export const getFromSecureStore = async (key) => {
  try {
    const item = await SecureStore.getItemAsync(key);
    console.log(`Retrieved item for key ${key}: ${item}`);
    return item;
  } catch (error) {
    console.error('Error reading from SecureStore', error);
  }
};

export const removeFromSecureStore = async (key) => {
  try {
    await SecureStore.deleteItemAsync(key);
    console.log(`Removed item with key ${key}`);
  } catch (error) {
    console.error('Error removing from SecureStore', error);
  }
};

export const removeKeyFromSecureStore = async (type, key) => {
  try {
    const keys = await SecureStore.getItemAsync(type + 'Keys') || '[]';
    const parsedKeys = JSON.parse(keys);
    const updatedKeys = parsedKeys.filter(item => item !== key);
    await SecureStore.setItemAsync(type + 'Keys', JSON.stringify(updatedKeys));
    console.log(`Removed ${key} from ${type}Keys`);
  } catch (error) {
    console.error('Error removing key from SecureStore', error);
  }
};

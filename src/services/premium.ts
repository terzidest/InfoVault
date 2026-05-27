import * as SecureStore from 'expo-secure-store';
import type { PremiumFeature } from '../types/models';

const PREMIUM_STATUS_KEY = 'premiumStatus';

export const checkPremiumStatus = async (): Promise<boolean> => {
  try {
    const status = await SecureStore.getItemAsync(PREMIUM_STATUS_KEY);
    return status === 'true';
  } catch (error) {
    console.error('Error checking premium status:', error);
    return false;
  }
};

export const setPremiumStatus = async (status: boolean): Promise<void> => {
  try {
    await SecureStore.setItemAsync(PREMIUM_STATUS_KEY, status ? 'true' : 'false');
  } catch (error) {
    console.error('Error setting premium status:', error);
    throw error;
  }
};

export const getPremiumFeatures = (): PremiumFeature[] => {
  return [
    {
      id: 'cloud_backup',
      name: 'Cloud Backup',
      description: 'Securely backup your data to the cloud',
      available: false,
    },
    {
      id: 'device_sync',
      name: 'Multi-Device Sync',
      description: 'Synchronize your data across multiple devices',
      available: false,
    },
    {
      id: 'custom_categories',
      name: 'Custom Categories',
      description: 'Create your own custom information categories',
      available: false,
    },
    {
      id: 'advanced_search',
      name: 'Advanced Search',
      description: 'Enhanced search capabilities across all your data',
      available: false,
    },
  ];
};

import * as SecureStore from 'expo-secure-store';

const PREMIUM_STATUS_KEY = 'premiumStatus';

/**
 * Check if user has premium status
 * @returns {Promise<boolean>} Premium status
 */
export const checkPremiumStatus = async () => {
  try {
    const status = await SecureStore.getItemAsync(PREMIUM_STATUS_KEY);
    return status === 'true';
  } catch (error) {
    console.error('Error checking premium status:', error);
    return false;
  }
};

/**
 * Set premium status (for future implementation)
 * @param {boolean} status - Premium status to set
 * @returns {Promise<void>}
 */
export const setPremiumStatus = async (status) => {
  try {
    await SecureStore.setItemAsync(PREMIUM_STATUS_KEY, status ? 'true' : 'false');
  } catch (error) {
    console.error('Error setting premium status:', error);
    throw error;
  }
};

/**
 * Get available premium features
 * @returns {Array} List of premium features
 */
export const getPremiumFeatures = () => {
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
    }
  ];
};

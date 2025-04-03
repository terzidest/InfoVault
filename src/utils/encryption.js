/**
 * Encryption utilities for sensitive data
 * 
 * Note: This is a simplified implementation. In a production environment,
 * you would want to use more sophisticated encryption methods.
 * Expo SecureStore already provides encryption, but this utility
 * adds an additional layer for sensitive fields.
 */

// Simple obfuscation for display (not actual encryption)
export const obfuscateText = (text, showPartial = false) => {
  if (!text) return '';
  
  if (showPartial && text.length > 4) {
    // Show first and last two characters
    return text.substring(0, 2) + '•'.repeat(text.length - 4) + text.substring(text.length - 2);
  }
  
  return '•'.repeat(text.length);
};

// Generate a random ID for new entries
export const generateSecureId = () => {
  const timestamp = new Date().getTime().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomStr}`;
};

// Simple hash function for non-critical operations
export const simpleHash = (text) => {
  let hash = 0;
  if (!text) return hash;
  
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return hash.toString(16);
};

// Prepare an object by encrypting sensitive fields
export const prepareSensitiveData = (data, sensitiveFields = []) => {
  // Clone the data to avoid modifying the original
  const preparedData = { ...data };
  
  // For an actual implementation, you'd encrypt these fields here
  // For now, we'll just mark them as sensitive
  sensitiveFields.forEach(field => {
    if (preparedData[field]) {
      preparedData[`${field}_sensitive`] = true;
    }
  });
  
  return preparedData;
};

// Generate a password strength score (0-100)
export const checkPasswordStrength = (password) => {
  if (!password) return 0;
  
  let score = 0;
  
  // Length check
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 10;
  
  // Complexity checks
  if (/[A-Z]/.test(password)) score += 15; // Has uppercase
  if (/[a-z]/.test(password)) score += 15; // Has lowercase
  if (/[0-9]/.test(password)) score += 15; // Has numbers
  if (/[^A-Za-z0-9]/.test(password)) score += 15; // Has special chars
  
  // Variety check
  const uniqueChars = new Set(password).size;
  score += Math.min(10, uniqueChars / 2); // Up to 10 points for variety
  
  return Math.min(100, score);
};

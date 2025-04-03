/**
 * Validation utilities for form inputs
 */

// Check if string is empty or only whitespace
export const isEmpty = (value) => {
  return value === undefined || value === null || value.trim() === '';
};

// Check if email is valid format
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Check if URL is valid format
export const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
};

// Check if string is a valid date (YYYY-MM-DD)
export const isValidDate = (dateString) => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

// Card number validation (Luhn algorithm)
export const isValidCardNumber = (cardNumber) => {
  const sanitized = cardNumber.replace(/\D/g, '');
  if (sanitized.length < 13 || sanitized.length > 19) return false;
  
  let sum = 0;
  let double = false;
  
  // Luhn algorithm
  for (let i = sanitized.length - 1; i >= 0; i--) {
    let digit = parseInt(sanitized.charAt(i));
    
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    
    sum += digit;
    double = !double;
  }
  
  return sum % 10 === 0;
};

// Validate form fields based on specific rules
export const validateFields = (data, rules) => {
  const errors = {};
  
  Object.keys(rules).forEach(field => {
    const value = data[field];
    const fieldRules = rules[field];
    
    // Required check
    if (fieldRules.required && isEmpty(value)) {
      errors[field] = 'This field is required';
      return;
    }
    
    // Skip further validation if empty and not required
    if (isEmpty(value) && !fieldRules.required) {
      return;
    }
    
    // Minimum length check
    if (fieldRules.minLength && value.length < fieldRules.minLength) {
      errors[field] = `Must be at least ${fieldRules.minLength} characters`;
      return;
    }
    
    // Maximum length check
    if (fieldRules.maxLength && value.length > fieldRules.maxLength) {
      errors[field] = `Must not exceed ${fieldRules.maxLength} characters`;
      return;
    }
    
    // Pattern check
    if (fieldRules.pattern && !new RegExp(fieldRules.pattern).test(value)) {
      errors[field] = fieldRules.patternMessage || 'Invalid format';
      return;
    }
    
    // Email validation
    if (fieldRules.email && !isValidEmail(value)) {
      errors[field] = 'Please enter a valid email address';
      return;
    }
    
    // URL validation
    if (fieldRules.url && !isValidUrl(value)) {
      errors[field] = 'Please enter a valid URL';
      return;
    }
    
    // Date validation
    if (fieldRules.date && !isValidDate(value)) {
      errors[field] = 'Please enter a valid date in YYYY-MM-DD format';
      return;
    }
    
    // Card number validation
    if (fieldRules.cardNumber && !isValidCardNumber(value)) {
      errors[field] = 'Please enter a valid card number';
      return;
    }
    
    // Custom validation
    if (fieldRules.validate && typeof fieldRules.validate === 'function') {
      const customError = fieldRules.validate(value, data);
      if (customError) {
        errors[field] = customError;
      }
    }
  });
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

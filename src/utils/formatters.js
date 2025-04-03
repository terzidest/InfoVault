/**
 * Formatter utilities for display and data formatting
 */

// Format date to human-readable string
export const formatDate = (date, format = 'full') => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj)) return '';
  
  // Short date: MM/DD/YYYY
  if (format === 'short') {
    return dateObj.toLocaleDateString();
  }
  
  // Medium date: MMM DD, YYYY
  if (format === 'medium') {
    return dateObj.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }
  
  // Full date with time: MMM DD, YYYY, hh:mm AM/PM
  return dateObj.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

// Format card number with spaces
export const formatCardNumber = (cardNumber) => {
  if (!cardNumber) return '';
  
  const sanitized = cardNumber.replace(/\s/g, '');
  const parts = [];
  
  for (let i = 0; i < sanitized.length; i += 4) {
    parts.push(sanitized.substring(i, i + 4));
  }
  
  return parts.join(' ');
};

// Format card number for display (mask all but last 4 digits)
export const formatCardNumberMasked = (cardNumber) => {
  if (!cardNumber) return '';
  
  const sanitized = cardNumber.replace(/\s/g, '');
  
  if (sanitized.length <= 4) return sanitized;
  
  const lastFour = sanitized.slice(-4);
  const maskedPart = '•••• '.repeat(Math.floor((sanitized.length - 4) / 4));
  
  return `${maskedPart}${lastFour}`;
};

// Format phone number: (XXX) XXX-XXXX
export const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return '';
  
  const sanitized = phoneNumber.replace(/\D/g, '');
  
  if (sanitized.length < 10) return sanitized;
  
  return `(${sanitized.slice(0, 3)}) ${sanitized.slice(3, 6)}-${sanitized.slice(6, 10)}`;
};

// Truncate text with ellipsis
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) return text;
  
  return text.substring(0, maxLength) + '...';
};

// Format relative time (e.g., "2 hours ago")
export const formatRelativeTime = (date) => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now - dateObj;
  
  // Convert to seconds
  const diffSec = Math.floor(diffMs / 1000);
  
  if (diffSec < 60) return 'just now';
  
  // Convert to minutes
  const diffMin = Math.floor(diffSec / 60);
  
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  
  // Convert to hours
  const diffHour = Math.floor(diffMin / 60);
  
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  
  // Convert to days
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  
  // Convert to weeks
  const diffWeek = Math.floor(diffDay / 7);
  
  if (diffWeek < 4) return `${diffWeek} week${diffWeek !== 1 ? 's' : ''} ago`;
  
  // Convert to months
  const diffMonth = Math.floor(diffDay / 30);
  
  if (diffMonth < 12) return `${diffMonth} month${diffMonth !== 1 ? 's' : ''} ago`;
  
  // Convert to years
  const diffYear = Math.floor(diffDay / 365);
  
  return `${diffYear} year${diffYear !== 1 ? 's' : ''} ago`;
};

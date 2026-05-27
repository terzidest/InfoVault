export const isEmpty = (value: unknown): boolean => {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isValidDate = (dateString: string): boolean => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;

  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
};

export const isValidCardNumber = (cardNumber: string): boolean => {
  const sanitized = cardNumber.replace(/\D/g, '');
  if (sanitized.length < 13 || sanitized.length > 19) return false;

  let sum = 0;
  let double = false;

  for (let i = sanitized.length - 1; i >= 0; i--) {
    let digit = parseInt(sanitized.charAt(i), 10);

    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    double = !double;
  }

  return sum % 10 === 0;
};

export interface FieldRule<TData = object> {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string | RegExp;
  patternMessage?: string;
  email?: boolean;
  url?: boolean;
  date?: boolean;
  cardNumber?: boolean;
  validate?: (value: unknown, data: TData) => string | undefined | null;
}

export type ValidationRules<TData> = {
  [K in keyof TData]?: FieldRule<TData>;
};

export interface ValidationResult<TData> {
  isValid: boolean;
  errors: Partial<Record<keyof TData, string>>;
}

export const validateFields = <TData extends object>(
  data: TData,
  rules: ValidationRules<TData>
): ValidationResult<TData> => {
  const errors: Partial<Record<keyof TData, string>> = {};

  (Object.keys(rules) as Array<keyof TData>).forEach((field) => {
    const value = (data as Record<keyof TData, unknown>)[field];
    const fieldRules = rules[field];
    if (!fieldRules) return;

    if (fieldRules.required && isEmpty(value)) {
      errors[field] = 'This field is required';
      return;
    }

    if (isEmpty(value) && !fieldRules.required) {
      return;
    }

    const stringValue = typeof value === 'string' ? value : String(value);

    if (fieldRules.minLength && stringValue.length < fieldRules.minLength) {
      errors[field] = `Must be at least ${fieldRules.minLength} characters`;
      return;
    }

    if (fieldRules.maxLength && stringValue.length > fieldRules.maxLength) {
      errors[field] = `Must not exceed ${fieldRules.maxLength} characters`;
      return;
    }

    if (fieldRules.pattern && !new RegExp(fieldRules.pattern).test(stringValue)) {
      errors[field] = fieldRules.patternMessage || 'Invalid format';
      return;
    }

    if (fieldRules.email && !isValidEmail(stringValue)) {
      errors[field] = 'Please enter a valid email address';
      return;
    }

    if (fieldRules.url && !isValidUrl(stringValue)) {
      errors[field] = 'Please enter a valid URL';
      return;
    }

    if (fieldRules.date && !isValidDate(stringValue)) {
      errors[field] = 'Please enter a valid date in YYYY-MM-DD format';
      return;
    }

    if (fieldRules.cardNumber && !isValidCardNumber(stringValue)) {
      errors[field] = 'Please enter a valid card number';
      return;
    }

    if (fieldRules.validate && typeof fieldRules.validate === 'function') {
      const customError = fieldRules.validate(value, data);
      if (customError) {
        errors[field] = customError;
      }
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

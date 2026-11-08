// Single source of truth for colors used from JS (style props, icon colors).
export const colors = {
  primary: '#006E90',
  secondary: '#FFC107',
  dark: '#333333',
  light: '#FFFFFF',
  danger: '#F44336',
  success: '#4CAF50',
  muted: '#999999',
  noteWork: '#2196F3',
  noteOther: '#9C27B0',
} as const;

// Shared note-category accent (used by the notes list rows and note detail).
export const noteCategoryColor = (category: string | undefined): string => {
  switch (category?.toLowerCase() || '') {
    case 'personal':
      return colors.success;
    case 'work':
      return colors.noteWork;
    case 'financial':
      return colors.secondary;
    case 'health':
      return colors.danger;
    default:
      return colors.noteOther;
  }
};

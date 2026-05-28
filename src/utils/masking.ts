// Display-only masking. NOT a security control — never rely on this to
// protect data; it only hides characters visually in the UI.
export const obfuscateText = (text: string | undefined | null, showPartial = false): string => {
  if (!text) return '';

  if (showPartial && text.length > 4) {
    return text.substring(0, 2) + '•'.repeat(text.length - 4) + text.substring(text.length - 2);
  }

  return '•'.repeat(text.length);
};

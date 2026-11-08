// Record UI building blocks (v2): token-driven, built on components/ui.
export { default as TemplateIcon } from './TemplateIcon';
export type { TemplateIconSize } from './TemplateIcon';
export { default as FieldValue, REVEAL_MS } from './FieldValue';
export { default as RecordRow } from './RecordRow';
export { default as PinnedCard, PINNED_CARD_WIDTH } from './PinnedCard';
export { default as TemplateChips } from './TemplateChips';
export { default as FieldEditorRow } from './FieldEditorRow';
export { default as TagEditor } from './TagEditor';
export { default as GeneratorSheet } from './GeneratorSheet';
export { useAutoHide, createAutoHideTimer, AUTO_HIDE_TICK_MS } from './useAutoHide';
export type { AutoHide, AutoHideTimer } from './useAutoHide';
export {
  TEMPLATE_ORDER,
  TEMPLATE_ICONS,
  KIND_ORDER,
  MAX_TAG_LENGTH,
  expiryBadge,
  kindCycle,
  normalizeTag,
  addTag,
  allValuesEmpty,
  moveField,
  validateDraft,
  rowCopyTarget,
  subtitleIsMono,
  countdown,
  normalizeUrl,
} from './recordUi';
export type { BadgeTone, ExpiryBadge, CopyTarget, CharClass, CharClasses, GeneratorLength, RecordDraft } from './recordUi';

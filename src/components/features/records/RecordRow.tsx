// One record in a list: template icon, title, the `subtitleFor` preview
// (mono when it is a number) and a trailing copy button for the subtitle's
// source value — or the first secret when nothing visible is set. Press
// feedback comes from ListRow.
import React from 'react';
import { IconButton, ListRow } from '../../ui';
import { copySensitive } from '../../../services/clipboard';
import { subtitleFor } from '../../../utils/records';
import type { VaultRecord } from '../../../types/models';
import TemplateIcon from './TemplateIcon';
import { rowCopyTarget, subtitleIsMono } from './recordUi';

interface RecordRowProps {
  record: VaultRecord;
  onPress: (record: VaultRecord) => void;
  /** Override the copy action (defaults to the clearing clipboard). */
  onCopy?: (value: string) => void;
  divider?: boolean;
  testID?: string;
}

const RecordRow: React.FC<RecordRowProps> = ({ record, onPress, onCopy, divider = false, testID }) => {
  const target = rowCopyTarget(record);

  const copy = () => {
    if (!target) return;
    if (onCopy) onCopy(target.value);
    else copySensitive(target.value).catch(() => {});
  };

  return (
    <ListRow
      title={record.title}
      subtitle={subtitleFor(record)}
      subtitleMono={subtitleIsMono(record)}
      leading={<TemplateIcon template={record.template} size="md" />}
      trailing={target ? <IconButton icon="copy-outline" accessibilityLabel={target.label} onPress={copy} /> : undefined}
      onPress={() => onPress(record)}
      divider={divider}
      testID={testID}
    />
  );
};

export default RecordRow;

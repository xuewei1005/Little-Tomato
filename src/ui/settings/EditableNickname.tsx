import { useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';

interface EditableNicknameProps {
  value: string;
  label: string;
  fallback: string;
  onSave: (value: string) => void;
}

export function EditableNickname({ value, label, fallback, onSave }: EditableNicknameProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const commit = () => { onSave(draft.trim() || fallback); setEditing(false); };
  if (!editing) return <button type="button" className="nickname-button" aria-label={t('common.editLabel', { label })} title={t('common.editHint', { label })} onClick={() => { setDraft(value); setEditing(true); }}>{value || fallback}</button>;
  return <input className="nickname-input" autoFocus aria-label={label} maxLength={20} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Enter') { event.preventDefault(); commit(); } if (event.key === 'Escape') setEditing(false); }} />;
}

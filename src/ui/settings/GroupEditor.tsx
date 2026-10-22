import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { TodoGroup } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';

interface GroupEditorProps {
  groups: TodoGroup[];
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function GroupEditor({ groups, onAdd, onRename, onDelete, onClose }: GroupEditorProps) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (name.trim()) { onAdd(name); setName(''); } };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal" aria-label={t('nav.groups')}><div className="modal-header"><div><h2>{t('group.manageTitle')}</h2><p>{t('group.manageHint')}</p></div><button className="icon-button" onClick={onClose} aria-label={t('common.close')}>×</button></div><div className="group-editor-list">{groups.map((group) => <div className="group-editor-row" key={group.id}><span className="group-dot" style={{ '--group-color': group.accentColor } as CSSProperties} /><span>{group.name}</span><button className="mini-action" onClick={() => { const next = window.prompt(t('group.newNamePrompt'), group.name); if (next) onRename(group.id, next); }}>{t('group.rename')}</button><button className="mini-action danger" onClick={() => onDelete(group.id)}>{t('group.deleteAction')}</button></div>)}{groups.length === 0 && <div className="empty-state" style={{ padding: 20 }}>{t('group.noGroups')}</div>}</div><form className="inline-add" onSubmit={submit}><input aria-label={t('group.newName')} value={name} onChange={(event) => setName(event.target.value)} placeholder={t('group.newName')} /><button type="submit">{t('group.add')}</button></form><div className="modal-footer"><button type="button" onClick={onClose}>{t('group.done')}</button></div></section></div>;
}

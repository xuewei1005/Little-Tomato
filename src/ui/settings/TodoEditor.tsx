import { useState } from 'react';
import type { TodoDraft, TodoGroup, TodoItem } from '../../domain/types';
import { formatTodoDate, lunarDateToSolarDateKey, solarDateToLunarDateKey } from '../../domain/todoDateService';
import { useI18n } from '../../i18n/I18nProvider';
import { TodoCalendar } from './TodoCalendar';

interface TodoEditorProps {
  groups: TodoGroup[];
  initialTodo?: TodoItem;
  onSave: (draft: TodoDraft) => void;
  onRequestCreateGroup: () => void;
  onDelete?: (todo: TodoItem) => void;
  onClose: () => void;
}

export function TodoEditor({ groups, initialTodo, onSave, onRequestCreateGroup, onDelete, onClose }: TodoEditorProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState(initialTodo?.title ?? '');
  const [note, setNote] = useState(initialTodo?.note ?? '');
  const [targetDate, setTargetDate] = useState(initialTodo?.targetDate ?? '');
  const [lunarDate, setLunarDate] = useState(initialTodo?.lunarDate ?? solarDateToLunarDateKey(initialTodo?.targetDate) ?? '');
  const [targetTime, setTargetTime] = useState(initialTodo?.targetTime ?? '');
  const [calendarType, setCalendarType] = useState(initialTodo?.calendarType ?? 'solar');
  const [groupId, setGroupId] = useState(initialTodo?.groupId ?? '');
  const [starred, setStarred] = useState(initialTodo?.starred ?? initialTodo?.pinned ?? false);
  const [repeatRule, setRepeatRule] = useState(initialTodo?.repeatRule ?? 'none');
  const [timeOpen, setTimeOpen] = useState(false);
  const [error, setError] = useState('');

  const visibleDate = calendarType === 'lunar' ? lunarDate : targetDate;
  const validDate = !visibleDate || Boolean(calendarType === 'lunar' ? lunarDateToSolarDateKey(visibleDate) : solarDateToLunarDateKey(visibleDate));
  const preview = visibleDate && validDate ? formatTodoDate({ calendarType: 'lunar', lunarDate: calendarType === 'lunar' ? lunarDate : solarDateToLunarDateKey(targetDate), targetTime }) : '';

  const selectDate = (value: string) => {
    setError('');
    if (calendarType === 'lunar') {
      setLunarDate(value);
      setTargetDate(lunarDateToSolarDateKey(value) ?? '');
    } else {
      setTargetDate(value);
      setLunarDate(solarDateToLunarDateKey(value) ?? '');
    }
  };

  const selectCalendar = (type: typeof calendarType) => {
    if (type === calendarType) return;
    if (!validDate) {
      setError(t('task.dateInvalid'));
      return;
    }
    if (type === 'solar') setTargetDate(lunarDateToSolarDateKey(lunarDate) ?? '');
    else setLunarDate(solarDateToLunarDateKey(targetDate) ?? '');
    setError('');
    setCalendarType(type);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError(t('task.titleRequired'));
      return;
    }
    if (!validDate) {
      setError(t('task.dateInvalid'));
      setTimeOpen(true);
      return;
    }
    if (targetTime && !/^([01]\d|2[0-3]):[0-5]\d$/u.test(targetTime)) {
      setError(t('task.timeInvalid'));
      setTimeOpen(true);
      return;
    }
    onSave({
      title,
      note,
      targetDate: calendarType === 'lunar' ? lunarDateToSolarDateKey(lunarDate) : targetDate || undefined,
      lunarDate: calendarType === 'lunar' ? lunarDate || undefined : undefined,
      targetTime: targetTime || undefined,
      calendarType,
      groupId: groupId || undefined,
      starred,
      repeatRule,
      pinned: false,
    });
  };

  const timeSummary = visibleDate
    ? `${validDate ? preview : t('task.datePending')} · ${repeatRule === 'none' ? t('task.noRepeat') : t('task.withRepeat')}`
    : targetTime ? `${formatTodoDate({ calendarType, targetTime, repeatRule })} · ${t('task.noDateAuto')}` : t('task.noDateAuto');

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <form className="modal" onSubmit={submit} aria-label={initialTodo ? t('task.edit') : t('task.new')}>
        <div className="modal-header"><div><h2>{initialTodo ? t('task.edit') : t('task.new')}</h2><p>{t('task.emptyHint')}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label={t('common.close')}>×</button></div>
        <div className="form-grid">
          <div className="field"><label htmlFor="todo-title">{t('task.title')}</label><input id="todo-title" autoFocus value={title} onChange={(event) => { setTitle(event.target.value); setError(''); }} placeholder={t('task.titlePlaceholder')} /></div>
          <div className="field"><label htmlFor="todo-note">{t('task.note')}</label><textarea id="todo-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder={t('task.notePlaceholder')} /></div>
          <div className="field"><label htmlFor="todo-group">{t('task.group')}</label><select id="todo-group" value={groupId} onChange={(event) => { if (event.target.value === '__new_group__') { onRequestCreateGroup(); return; } setGroupId(event.target.value); }}><option value="">{t('task.ungrouped')}</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}<option value="__new_group__">{t('task.newGroup')}</option></select></div>
          <section className="todo-time-settings" aria-label={t('task.timeSettings')}>
            <button type="button" className="todo-time-toggle" aria-expanded={timeOpen} onClick={() => setTimeOpen((value) => !value)}>
              <span><strong>{t('task.timeSettings')}</strong><small>{timeSummary}</small></span><span aria-hidden="true">{timeOpen ? '⌃' : '⌄'}</span>
            </button>
            {timeOpen && <div className="todo-time-panel">
              <div className="field"><label id="todo-calendar-type">{t('task.dateType')}</label><div className="segmented" role="group" aria-labelledby="todo-calendar-type"><button type="button" className={calendarType === 'solar' ? 'active' : ''} aria-pressed={calendarType === 'solar'} onClick={() => selectCalendar('solar')}>{t('task.solar')}</button><button type="button" className={calendarType === 'lunar' ? 'active' : ''} aria-pressed={calendarType === 'lunar'} onClick={() => selectCalendar('lunar')}>{t('task.lunar')}</button></div></div>
              <TodoCalendar key={calendarType} calendarType={calendarType} value={visibleDate} onChange={selectDate} />
              {preview && <p className="todo-date-preview" role="status" aria-label={t('task.datePreview')}>{preview}</p>}
              <div className="field"><label htmlFor="todo-time">{t('task.timeOptional')}</label><input id="todo-time" type="time" value={targetTime} onChange={(event) => { setTargetTime(event.target.value); setError(''); }} /><p className="todo-date-hint">{t('task.timeHint')}</p></div>
              <div className="field"><label htmlFor="todo-repeat">{t('task.repeat')}</label><select id="todo-repeat" value={repeatRule} onChange={(event) => setRepeatRule(event.target.value as typeof repeatRule)}><option value="none">{t('task.noRepeat')}</option><option value="daily">{t('task.repeatDaily')}</option><option value="weekly">{t('task.repeatWeekly')}</option><option value="monthly">{t('task.repeatMonthly')}</option><option value="yearly">{t('task.repeatYearly')}</option></select></div>
              {repeatRule === 'yearly' && <p className="todo-date-hint">{t('task.yearlyHint')}</p>}
            </div>}
          </section>
          {error && <p className="todo-date-error" role="alert">{error}</p>}
          <label className="checkbox-row"><input type="checkbox" checked={starred} onChange={(event) => setStarred(event.target.checked)} />{t('task.star')}</label>
        </div>
        <div className="modal-footer">{initialTodo && onDelete && <button type="button" className="danger-text-button" onClick={() => onDelete(initialTodo)}>{t('task.delete')}</button>}<span className="modal-footer-spacer" /><button type="button" onClick={onClose}>{t('task.discard')}</button><button className="save" type="submit">{t('task.saveThing')}</button></div>
      </form>
    </div>
  );
}

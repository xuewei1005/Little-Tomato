import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TodoGroup, TodoItem } from '../../domain/types';
import { formatTodoDate, getTodoDateSnapshot } from '../../domain/todoDateService';
import { sortTodosForDisplay } from '../../domain/todoGroupStore';
import { useI18n } from '../../i18n/I18nProvider';

interface TodoListPanelProps {
  todos: TodoItem[];
  heading: string;
  search: string;
  onSearchChange: (value: string) => void;
  onToggle: (todo: TodoItem) => void;
  onStar: (todo: TodoItem) => void;
  onEdit: (todo: TodoItem) => void;
  onDelete: (todo: TodoItem) => void;
  onAdd: () => void;
  groups: TodoGroup[];
  onMoveToGroup: (todo: TodoItem, groupId?: string) => void;
  onCreateGroup: (todo: TodoItem) => void;
}

interface ContextMenuState {
  todo: TodoItem;
  x: number;
  y: number;
}

export function TodoListPanel({ todos, heading, search, onSearchChange, onToggle, onStar, onEdit, onDelete, onAdd, groups, onMoveToGroup, onCreateGroup }: TodoListPanelProps) {
  const { t } = useI18n();
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const filteredTodos = todos.filter((todo) => `${todo.title} ${todo.note}`.toLowerCase().includes(search.trim().toLowerCase()));
  const visibleTodos = sortTodosForDisplay(filteredTodos);

  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current) return;
    const bounds = menuRef.current.getBoundingClientRect();
    const x = Math.max(8, Math.min(contextMenu.x, window.innerWidth - bounds.width - 8));
    const y = Math.max(8, Math.min(contextMenu.y, window.innerHeight - bounds.height - 8));
    if (x !== contextMenu.x || y !== contextMenu.y) setContextMenu({ ...contextMenu, x, y });
  }, [contextMenu]);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setContextMenu(null); };
    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const openContextMenu = (event: React.MouseEvent<HTMLElement>, todo: TodoItem) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedTodoId(todo.id);
    setContextMenu({ todo, x: event.clientX, y: event.clientY });
  };

  const chooseContextAction = (action: 'edit' | 'toggle' | 'star' | 'delete') => {
    if (!contextMenu) return;
    const todo = contextMenu.todo;
    setContextMenu(null);
    if (action === 'edit') onEdit(todo);
    if (action === 'toggle') onToggle(todo);
    if (action === 'star') onStar(todo);
    if (action === 'delete') onDelete(todo);
  };

  return (
    <section aria-label={t('task.emptyTitle')}>
      <div className="todo-toolbar">
        <div className="todo-heading"><h2>{heading}</h2><span>{todos.length ? t('task.itemCount', { count: todos.length }) : t('task.emptyHint')}</span></div>
        <div className="todo-toolbar-tools"><input className="todo-search" aria-label={t('task.filter')} value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={t('task.filterPlaceholder')} /><button className="pill-button primary-button" onClick={onAdd}>{t('task.add')}</button></div>
      </div>
      {visibleTodos.length ? <div className="todo-list">{visibleTodos.map((todo) => {
        const date = getTodoDateSnapshot(todo);
        return <article
          className={`task-row ${todo.status === 'completed' ? 'completed' : ''} ${selectedTodoId === todo.id ? 'selected' : ''}`}
          key={todo.id}
          onClick={() => setSelectedTodoId(todo.id)}
          onContextMenu={(event) => openContextMenu(event, todo)}
          tabIndex={0}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedTodoId(todo.id); }}
        >
          <button className={`task-check ${todo.status === 'completed' ? 'checked' : ''}`} onClick={(event) => { event.stopPropagation(); onToggle(todo); }} aria-label={todo.status === 'completed' ? t('task.reopenTitle', { title: todo.title }) : t('task.completeTitle', { title: todo.title })}>{todo.status === 'completed' ? '✓' : ''}</button>
          <button className="task-main" onClick={(event) => { event.stopPropagation(); setSelectedTodoId(todo.id); }} style={{ border: 0, background: 'transparent', textAlign: 'left', padding: 0, cursor: 'default' }}><div className="task-title">{todo.title}</div><div className={`task-meta ${date.isOverdue ? 'overdue' : ''}`}><span>{date.label}</span>{todo.targetDate && <span>· {formatTodoDate(todo)}</span>}{todo.groupId && <span>· {t('task.assignedGroup')}</span>}</div></button>
          <button className={`task-star ${todo.starred ? 'starred' : ''}`} onClick={(event) => { event.stopPropagation(); onStar(todo); }} aria-label={todo.starred ? t('task.unstarTitle', { title: todo.title }) : t('task.starTitle', { title: todo.title })}>{todo.starred ? '★' : '☆'}</button>
        </article>;
      })}</div> : <div className="empty-state"><div className="empty-emoji">🍅</div><strong>{search ? t('task.emptySearchTitle') : t('task.emptyTitle')}</strong><span>{search ? t('task.emptySearchHint') : t('task.emptyHint')}</span><br /><button className="pill-button primary-button" style={{ marginTop: 15 }} onClick={onAdd}>{t('task.addOne')}</button></div>}
      {contextMenu && <div ref={menuRef} className="todo-context-menu" role="menu" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()}>
        <button type="button" role="menuitem" onClick={() => chooseContextAction('edit')}>{t('task.editSettings')}</button>
        <button type="button" role="menuitem" onClick={() => chooseContextAction('toggle')}>{contextMenu.todo.status === 'completed' ? t('task.reopen') : t('task.complete')}</button>
        <button type="button" role="menuitem" onClick={() => chooseContextAction('star')}>{contextMenu.todo.starred ? t('task.unmarkImportant') : t('task.markImportant')}</button>
        <div className="todo-context-group-section" role="group" aria-label={t('task.moveToGroup')}><span>{t('task.moveToGroup')}</span><button type="button" role="menuitem" onClick={() => { onMoveToGroup(contextMenu.todo, undefined); setContextMenu(null); }}>{t('task.ungrouped')}</button>{groups.map((group) => <button type="button" role="menuitem" key={group.id} onClick={() => { onMoveToGroup(contextMenu.todo, group.id); setContextMenu(null); }}>{group.name}</button>)}<button type="button" role="menuitem" onClick={() => { onCreateGroup(contextMenu.todo); setContextMenu(null); }}>{t('task.newGroup')}</button></div>
        <button type="button" role="menuitem" className="danger" onClick={() => chooseContextAction('delete')}>{t('task.deleteTask')}</button>
      </div>}
    </section>
  );
}

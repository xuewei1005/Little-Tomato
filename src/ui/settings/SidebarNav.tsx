import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TodoGroup, TodoSmartView } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import type { CSSProperties } from 'react';
import { AppIcon } from '../branding/AppIcon';

interface SidebarNavProps {
  activeView: TodoSmartView;
  groups: TodoGroup[];
  counts: Record<string, number>;
  onSelect: (view: TodoSmartView) => void;
  onOpenGroups: () => void;
  onCreateGroup: () => void;
  onDeleteGroup: (id: string) => void;
}

interface SidebarContextMenu {
  kind: 'blank' | 'group';
  group?: TodoGroup;
  x: number;
  y: number;
}

type SidebarIconName = 'important' | 'active' | 'completed';

function SidebarIcon({ name }: { name: SidebarIconName }) {
  const iconProps = {
    className: 'nav-icon',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'data-icon': name,
    'aria-hidden': true,
  };

  if (name === 'important') {
    return <svg {...iconProps}><path d="m12 3.7 2.7 5.5 6 .9-4.3 4.2 1 5.9-5.4-2.8-5.4 2.8 1-5.9-4.3-4.2 6-.9L12 3.7Z" /></svg>;
  }

  if (name === 'active') {
    return <svg {...iconProps}><path d="M8 6.5h11M8 12h11M8 17.5h11" /><path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" strokeWidth="2.7" /></svg>;
  }

  return <svg {...iconProps}><circle cx="12" cy="12" r="8.5" /><path d="m8.3 12 2.4 2.4 4.9-5" /></svg>;
}

export function SidebarNav({ activeView, groups, counts, onSelect, onOpenGroups, onCreateGroup, onDeleteGroup }: SidebarNavProps) {
  const { t } = useI18n();
  const [contextMenu, setContextMenu] = useState<SidebarContextMenu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const smartViews: Array<{ id: TodoSmartView; icon: SidebarIconName; label: string; className?: string }> = [
    { id: 'active', icon: 'active', label: t('nav.pending') },
    { id: 'important', icon: 'important', label: t('nav.important'), className: 'important' },
  ];

  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current) return;
    const bounds = menuRef.current.getBoundingClientRect();
    const x = Math.max(8, Math.min(contextMenu.x, window.innerWidth - bounds.width - 8));
    const y = Math.max(8, Math.min(contextMenu.y, window.innerHeight - bounds.height - 8));
    if (x !== contextMenu.x || y !== contextMenu.y) setContextMenu({ ...contextMenu, x, y });
  }, [contextMenu]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  const openBlankContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    setContextMenu({ kind: 'blank', x: event.clientX, y: event.clientY });
  };

  const openGroupContextMenu = (event: React.MouseEvent<HTMLElement>, group: TodoGroup) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect(`group:${group.id}`);
    setContextMenu({ kind: 'group', group, x: event.clientX, y: event.clientY });
  };

  return (
    <aside className="app-sidebar" onContextMenu={openBlankContextMenu}>
      <div className="brand-lockup">
        <AppIcon className="brand-mark" />
        <div><div className="brand-name">{t('app.name')}</div><div className="brand-subtitle">{t('app.subtitle')}</div></div>
      </div>
      <div className="sidebar-search"><span>⌕</span><input aria-label={t('nav.search')} placeholder={t('nav.search')} /></div>
      <div className="sidebar-navigation">
        <div>
          <div className="sidebar-section-title"><span>{t('nav.smart')}</span></div>
          <nav className="sidebar-nav" aria-label={t('nav.smart')}>
            {smartViews.map((item) => (
              <button key={item.id} className={`nav-item ${item.className ?? ''} ${activeView === item.id ? 'active' : ''}`} onClick={() => onSelect(item.id)}>
                <SidebarIcon name={item.icon} /><span className="nav-label">{item.label}</span><span className="nav-count">{counts[item.id] ?? 0}</span>
              </button>
            ))}
          </nav>
        </div>
        <div>
          <div className="sidebar-section-title"><span>{t('nav.groups')}</span><button className="mini-action" onClick={onOpenGroups} aria-label={t('nav.manage')}>{t('nav.manage')}</button></div>
          <nav className="group-list" aria-label={t('nav.groups')}>
            {groups.map((group) => (
              <button key={group.id} className={`nav-item ${activeView === `group:${group.id}` ? 'active' : ''}`} onClick={() => onSelect(`group:${group.id}`)} onContextMenu={(event) => openGroupContextMenu(event, group)}>
                <span className="group-dot group-icon-slot" style={{ '--group-color': group.accentColor } as CSSProperties} />
                <span className="nav-label">{group.name}</span><span className="nav-count">{counts[`group:${group.id}`] ?? 0}</span>
              </button>
            ))}
            {groups.length === 0 && <div style={{ color: 'var(--ink-faint)', fontSize: 12, padding: '11px 10px' }}>{t('nav.emptyGroups')}</div>}
          </nav>
        </div>
        <nav className="sidebar-nav completed-nav" aria-label={t('nav.completed')}>
          <button className={`nav-item completed-view ${activeView === 'completed' ? 'active' : ''}`} onClick={() => onSelect('completed')}>
            <SidebarIcon name="completed" /><span className="nav-label">{t('nav.completed')}</span><span className="nav-count">{counts.completed ?? 0}</span>
          </button>
        </nav>
      </div>
      <div className="sidebar-bottom"><button className="subtle-button" onClick={onOpenGroups}>{t('nav.addManageGroup')}</button></div>
      {contextMenu && <div ref={menuRef} className="sidebar-context-menu" role="menu" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()}>
        <button type="button" role="menuitem" onClick={() => { setContextMenu(null); onCreateGroup(); }}>{t('group.new')}</button>
        {contextMenu.kind === 'group' && contextMenu.group && <button type="button" role="menuitem" className="danger" onClick={() => { const id = contextMenu.group?.id; setContextMenu(null); if (id) onDeleteGroup(id); }}>{t('group.delete')}</button>}
      </div>}
    </aside>
  );
}

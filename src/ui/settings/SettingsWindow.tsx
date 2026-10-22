import { useEffect, useMemo, useRef, useState } from 'react';
import { getHolidayReminderMessage } from '../../domain/calendarService';
import { confirmStandUp, createFocusTimerState, formatTimerSeconds, pauseFocusTimer, resumeFocusTimer, skipFocusTimer, startFocusTimer, tickFocusTimer } from '../../domain/focusTimer';
import { createTodoGroup, deleteTodoGroup, filterTodosByView, getTodoCounts, renameTodoGroup } from '../../domain/todoGroupStore';
import { getPetVisualState } from '../../domain/petStateMachine';
import { isInQuietHours, getNextScheduledReminder } from '../../domain/reminderScheduler';
import { loadSettings, saveSettings } from '../../domain/settingsStore';
import { getRandomTip } from '../../domain/tipsLibrary';
import { completeTodo, createTodo, deleteTodo, reopenTodo, toggleTodoStar, updateTodo } from '../../domain/todoStore';
import { getDefaultTodoSyncPath, readTodoSyncFile, writeTodoSyncFile } from '../../domain/todoFileBridge';
import { mergeTodoSyncDocuments, parseTodoSyncDocument, serializeTodoSyncDocument } from '../../domain/todoSync';
import type { AppLanguage, AppSettings, TodoDraft, TodoGroup, TodoItem, TodoSmartView } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { PetAvatar } from '../pet/PetAvatar';
import { PetBubble } from '../pet/PetBubble';
import { AppearanceSettings } from './AppearanceSettings';
import { FocusDurationSettings } from './FocusDurationSettings';
import { GroupEditor } from './GroupEditor';
import { SidebarNav } from './SidebarNav';
import { TodoEditor } from './TodoEditor';
import { TodoListPanel } from './TodoListPanel';
import { TodoSyncSettings } from './TodoSyncSettings';
import { WindowTitlebar } from '../window/WindowTitlebar';
import { showDesktopPet, toggleDesktopPet } from '../window/petWindow';
import { listen } from '@tauri-apps/api/event';
import { emitTo } from '@tauri-apps/api/event';
import { PET_RUNTIME_EVENT, PET_RUNTIME_SYNC_REQUEST, type PetRuntimeEvent } from '../../domain/petRuntime';
import { buildPetSettingsEvent, buildScheduledReminderEvent, buildTimerStateEvent, buildTodoReminderEvent, pickTodoReminder } from './runtimeBridge';
import { applyPetCommand, PET_COMMAND_EVENT } from '../window/petCommands';
import { AppIcon } from '../branding/AppIcon';
import { performWindowAction } from '../window/windowActions';
import { TipsLyrics } from './TipsLyrics';
import { EditableNickname } from './EditableNickname';

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function sendPetRuntimeEvent(event: PetRuntimeEvent): void {
  if (!isTauriRuntime()) return;
  void emitTo('pet', PET_RUNTIME_EVENT, event).catch(() => {
    // 宠物窗口可能暂时隐藏或正在关闭，不影响主窗口继续工作。
  });
}

interface SettingsWindowProps {
  onLanguageChange?: (language: AppLanguage) => void;
}

export function SettingsWindow({ onLanguageChange }: SettingsWindowProps = {}) {
  const { t, formatDate } = useI18n();
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [activeView, setActiveView] = useState<TodoSmartView>(() => loadSettings().activeTodoView);
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<{ open: boolean; todo?: TodoItem }>({ open: false });
  const [showGroups, setShowGroups] = useState(false);
  const [groupTargetTodoId, setGroupTargetTodoId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPetPreview, setShowPetPreview] = useState(false);
  const [petVisible, setPetVisible] = useState(() => settings.showPetOnStartup);
  const [petWindowError, setPetWindowError] = useState<string | null>(null);
  const [todoSyncStatus, setTodoSyncStatus] = useState(() => t('sync.notEnabled'));
  const [tip, setTip] = useState(() => getRandomTip());
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [timer, setTimer] = useState(() => createFocusTimerState({ ...settings.focus, standUpMinutes: settings.standUpMinutes }));
  const settingsRef = useRef(settings);
  const timerRef = useRef(timer);
  const syncReadyRef = useRef(false);
  const syncInFlightRef = useRef(false);
  settingsRef.current = settings;
  timerRef.current = timer;
  const holidayReminderKey = useRef<string | null>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (editor.open) { setEditor({ open: false }); return; }
      if (showSettings) { setShowSettings(false); return; }
      if (showGroups) { setShowGroups(false); return; }
      if (showPetPreview) { setShowPetPreview(false); return; }
      void performWindowAction('close');
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [editor.open, showGroups, showPetPreview, showSettings]);

  useEffect(() => { saveSettings({ ...settings, activeTodoView: activeView }); document.documentElement.dataset.theme = resolveTheme(settings.themeMode); }, [settings, activeView]);
  useEffect(() => {
    setTimer((state) => {
      if (state.status !== 'idle') return state;
      const totalSec = settings.focus.focusMinutes * 60;
      if (state.totalSec === totalSec && state.remainingSec === totalSec) return state;
      return { ...state, totalSec, remainingSec: totalSec };
    });
  }, [settings.focus.focusMinutes]);
  useEffect(() => {
    const id = window.setInterval(() => {
      const currentMs = Date.now();
      setNow(currentMs);
      setTimer((state) => tickFocusTimer(state, currentMs, { ...settings.focus, standUpMinutes: settings.standUpMinutes }));
    }, 1_000);
    return () => window.clearInterval(id);
  }, [settings.focus, settings.standUpMinutes]);
  useEffect(() => {
    sendPetRuntimeEvent(buildTimerStateEvent(timer, Date.now()));
  }, [timer]);
  useEffect(() => {
    sendPetRuntimeEvent(buildPetSettingsEvent({
      language: settings.language,
      petName: settings.petName,
      displayName: settings.displayName,
      petTheme: settings.petTheme,
      opacity: settings.opacity,
      animationEnabled: settings.animationEnabled,
    }, Date.now()));
  }, [settings.language, settings.petName, settings.displayName, settings.petTheme, settings.opacity, settings.animationEnabled]);
  useEffect(() => {
    if (!isTauriRuntime()) return;
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void listen(PET_RUNTIME_SYNC_REQUEST, () => {
      if (!disposed) {
        const emittedAtMs = Date.now();
        sendPetRuntimeEvent(buildTimerStateEvent(timerRef.current, emittedAtMs));
        const current = settingsRef.current;
        sendPetRuntimeEvent(buildPetSettingsEvent({ language: current.language, petName: current.petName, displayName: current.displayName, petTheme: current.petTheme, opacity: current.opacity, animationEnabled: current.animationEnabled }, emittedAtMs));
      }
    }).then((cleanup) => {
      if (disposed) cleanup();
      else unlisten = cleanup;
    }).catch(() => undefined);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
  useEffect(() => {
    const checkReminders = () => {
      const currentMs = Date.now();
      const currentDate = new Date(currentMs);
      if (isInQuietHours(currentDate, settings.quietHours)) return;
      const scheduled = getNextScheduledReminder(currentDate, settings.scheduledReminders, settings.quietHours);
      const holidayMessage = settings.holidayReminderEnabled ? getHolidayReminderMessage(currentDate) : null;
      const holidayKey = holidayMessage ? `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}` : null;
      if (!holidayMessage) holidayReminderKey.current = null;
      const candidate = pickTodoReminder(settings.todoItems, currentMs, settings.reminderMode);
      if (candidate) {
        const todoEvent = buildTodoReminderEvent(candidate, currentMs, settings.displayName, settings.petName, settings.language);
        setReminderMessage(todoEvent.message);
        sendPetRuntimeEvent(todoEvent);
        setSettings((current) => ({ ...current, todoItems: current.todoItems.map((todo) => todo.id === candidate.id ? { ...todo, lastRemindedAtMs: currentMs } : todo) }));
      } else if (scheduled) {
        const message = `${scheduled.title} · 现在是 ${scheduled.time}`;
        setReminderMessage(message);
        sendPetRuntimeEvent(buildScheduledReminderEvent(message, currentMs));
      } else if (holidayMessage && holidayReminderKey.current !== holidayKey) {
        setReminderMessage(holidayMessage);
        sendPetRuntimeEvent(buildScheduledReminderEvent(holidayMessage, currentMs));
        holidayReminderKey.current = holidayKey;
      }
    };
    const id = window.setInterval(checkReminders, 15_000);
    checkReminders();
    return () => window.clearInterval(id);
  }, [settings.todoItems, settings.reminderMode, settings.quietHours, settings.scheduledReminders, settings.holidayReminderEnabled]);

  const todos = settings.todoItems;
  const groups = settings.todoGroups;
  const counts = useMemo(() => getTodoCounts(todos, new Date(now)), [todos, now]);
  const filteredTodos = useMemo(() => filterTodosByView(todos, activeView, new Date(now)), [todos, activeView, now]);
  const visualState = getPetVisualState({ focusPhase: timer.phase, hasReminder: Boolean(reminderMessage) || timer.phase === 'shortBreak' || timer.phase === 'longBreak', hasIncomingNotification: false });
  const currentViewLabel = activeView === 'important' ? t('nav.important') : activeView === 'completed' ? t('nav.completed') : activeView === 'active' || activeView === 'all' ? t('nav.pending') : groups.find((group) => `group:${group.id}` === activeView)?.name ?? t('nav.pending');

  const patchSettings = (patch: Partial<AppSettings>) => {
    if (patch.language) onLanguageChange?.(patch.language);
    setSettings((current) => ({ ...current, ...patch }));
  };
  const saveTodo = (draft: TodoDraft) => { setSettings((current) => ({ ...current, todoItems: editor.todo ? current.todoItems.map((todo) => todo.id === editor.todo?.id ? updateTodo(todo, draft) : todo) : [createTodo(draft), ...current.todoItems] })); setEditor({ open: false }); };
  const removeTodo = (todo: TodoItem) => {
    setSettings((current) => ({ ...current, todoItems: current.todoItems.map((item) => item.id === todo.id ? deleteTodo(item) : item) }));
    setEditor({ open: false });
  };
  const toggleTodo = (todo: TodoItem) => setSettings((current) => ({ ...current, todoItems: current.todoItems.map((item) => item.id === todo.id ? (item.status === 'completed' ? reopenTodo(item) : completeTodo(item)) : item) }));
  const starTodo = (todo: TodoItem) => setSettings((current) => ({ ...current, todoItems: current.todoItems.map((item) => item.id === todo.id ? toggleTodoStar(item) : item) }));
  const openGroupManager = (todo?: TodoItem) => { setGroupTargetTodoId(todo?.id ?? null); setShowGroups(true); };
  const addGroup = (name: string) => {
    const targetTodoId = groupTargetTodoId;
    setSettings((current) => {
      const group = createTodoGroup(name, Date.now(), current.todoGroups.length);
      return {
        ...current,
        todoGroups: [...current.todoGroups, group],
        todoItems: targetTodoId ? current.todoItems.map((todo) => todo.id === targetTodoId ? { ...todo, groupId: group.id, updatedAtMs: Date.now() } : todo) : current.todoItems,
      };
    });
    if (targetTodoId) setGroupTargetTodoId(null);
  };
  const moveTodoToGroup = (todo: TodoItem, groupId?: string) => setSettings((current) => ({ ...current, todoItems: current.todoItems.map((item) => item.id === todo.id ? { ...item, groupId, updatedAtMs: Date.now() } : item) }));
  const renameGroup = (id: string, name: string) => setSettings((current) => ({ ...current, todoGroups: renameTodoGroup(current.todoGroups, id, name) }));
  const removeGroup = (id: string) => {
    setActiveView((current) => current === `group:${id}` ? 'active' : current);
    setSettings((current) => { const result = deleteTodoGroup(current.todoGroups, current.todoItems, id); return { ...current, ...result, activeTodoView: current.activeTodoView === `group:${id}` ? 'active' : current.activeTodoView }; });
  };
  const timerConfig = { ...settings.focus, standUpMinutes: settings.standUpMinutes };
  const startTimer = () => setTimer((state) => {
    if (state.status === 'awaitingStandUp') return state;
    return state.status === 'paused' ? resumeFocusTimer(state, Date.now()) : startFocusTimer(state, Date.now(), timerConfig);
  });
  const pauseTimer = () => setTimer((state) => pauseFocusTimer(state, Date.now(), timerConfig));
  const resumeTimer = () => setTimer((state) => state.status === 'paused' ? resumeFocusTimer(state, Date.now()) : state);
  const confirmStandUpTimer = () => setTimer((state) => confirmStandUp(state, Date.now(), timerConfig));
  const skipTimer = () => setTimer((state) => skipFocusTimer(state, Date.now(), timerConfig));
  useEffect(() => {
    if (!isTauriRuntime()) return;
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void listen<string>(PET_COMMAND_EVENT, ({ payload }) => {
      applyPetCommand(payload, {
        startTimer,
        pauseTimer,
        resumeTimer,
        confirmStandUp: confirmStandUpTimer,
        addTodo: () => setEditor({ open: true }),
      });
    }).then((cleanup) => {
      if (disposed) cleanup();
      else unlisten = cleanup;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [settings.focus, settings.standUpMinutes]);
  const syncTodoFile = async () => {
    const current = settingsRef.current;
    const path = current.todoSyncPath.trim();
    if (!current.todoSyncEnabled || !path) {
      setTodoSyncStatus(t('sync.notEnabled'));
      return;
    }
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    setTodoSyncStatus(t('sync.reading'));
    const csv = await readTodoSyncFile(path);
    const latest = settingsRef.current;
    if (latest.todoSyncPath.trim() !== path || !latest.todoSyncEnabled) {
      syncInFlightRef.current = false;
      return;
    }
    const local = { todos: latest.todoItems, groups: latest.todoGroups };
    const remote = csv ? parseTodoSyncDocument(csv) : { todos: [], groups: [] };
    const hasRemoteRecords = remote.todos.length > 0 || remote.groups.length > 0;
    const merged = hasRemoteRecords ? mergeTodoSyncDocuments(local, remote) : { ...local, importedCount: 0, conflictCount: 0 };
    if (hasRemoteRecords && (merged.importedCount > 0 || merged.conflictCount > 0)) {
      setSettings((latest) => latest.todoSyncPath.trim() === path ? { ...latest, todoItems: merged.todos, todoGroups: merged.groups } : latest);
    }
    const wrote = await writeTodoSyncFile(path, serializeTodoSyncDocument(merged.todos, merged.groups));
    syncReadyRef.current = wrote;
    setTodoSyncStatus(wrote
      ? `${t('sync.synced', { count: merged.todos.length })}${merged.importedCount > 0 ? t('sync.merged', { count: merged.importedCount }) : ''}`
      : t('sync.writeError'));
    syncInFlightRef.current = false;
  };

  useEffect(() => {
    syncReadyRef.current = false;
    if (!settings.todoSyncEnabled || !settings.todoSyncPath.trim()) {
      setTodoSyncStatus(t('sync.notEnabled'));
      return;
    }
    void syncTodoFile();
  }, [settings.todoSyncEnabled, settings.todoSyncPath]);

  useEffect(() => {
    if (!settings.todoSyncEnabled || !settings.todoSyncPath.trim() || !syncReadyRef.current) return;
    const id = window.setTimeout(() => {
      const current = settingsRef.current;
      void writeTodoSyncFile(current.todoSyncPath.trim(), serializeTodoSyncDocument(current.todoItems, current.todoGroups)).then((wrote) => {
        if (wrote) setTodoSyncStatus(t('sync.autoSaved', { count: current.todoItems.length }));
      });
    }, 350);
    return () => window.clearTimeout(id);
  }, [settings.todoItems, settings.todoGroups, settings.todoSyncEnabled, settings.todoSyncPath]);

  useEffect(() => {
    const handleFocus = () => {
      if (settingsRef.current.todoSyncEnabled) void syncTodoFile();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [settings.todoSyncEnabled, settings.todoSyncPath]);
  const togglePetWindow = async () => {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      try {
        const visible = await toggleDesktopPet();
        setPetVisible(visible);
        setPetWindowError(null);
        return;
      } catch (error) {
        setPetWindowError(error instanceof Error ? error.message : t('pet.windowError'));
        return;
      }
    }
    setShowPetPreview((value) => {
      const next = !value;
      setPetVisible(next);
      return next;
    });
  };
  useEffect(() => {
    if (!settings.showPetOnStartup || typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;
    void (async () => {
      try {
        await showDesktopPet();
        setPetVisible(true);
      } catch (error) {
        setPetWindowError(error instanceof Error ? error.message : t('pet.windowError'));
      }
    })();
  }, [settings.showPetOnStartup]);

  return <div className="window-frame"><WindowTitlebar /><div className="app-shell"><SidebarNav activeView={activeView} groups={groups} counts={counts} onSelect={(view) => { setActiveView(view); patchSettings({ activeTodoView: view }); }} onOpenGroups={() => setShowGroups(true)} onCreateGroup={() => openGroupManager()} onDeleteGroup={removeGroup} /><main className="main-content"><header className="topbar"><div><div className="eyebrow">GOOD TO SEE YOU · {formatDate(new Date(now), { month: 'long', day: 'numeric', weekday: 'long' })}</div><h1 className="page-title">TODO</h1></div><div className="top-actions"><button className="icon-button pet-open-button" onClick={togglePetWindow} aria-label={petVisible ? t('pet.hide') : t('pet.show')} title={petVisible ? t('pet.hide') : t('pet.show')}><AppIcon className="top-pet-icon" /></button><button className="icon-button" onClick={() => setShowSettings(true)} aria-label={t('pet.settings')}>⚙</button></div></header>
      <section className="dashboard-grid"><div className="card focus-card"><div className="card-kicker"><span className="focus-speaker"><EditableNickname value={settings.petName} label={t('pet.nicknameLabel')} fallback={t('app.name')} onSave={(petName) => patchSettings({ petName })} />：</span><EditableNickname value={settings.displayName} label={t('pet.userNicknameLabel')} fallback="主人" onSave={(displayName) => patchSettings({ displayName })} /><span> {t('pet.focusLine')}</span></div><div className="focus-row"><div><div className="timer-display">{formatTimerSeconds(timer.remainingSec)}</div><div className="timer-phase">{timer.phase === 'idle' ? t('timer.ready') : timer.phase === 'focus' ? t('timer.focus') : timer.phase === 'shortBreak' ? t('timer.shortBreak') : timer.phase === 'longBreak' ? t('timer.longBreak') : t('timer.standUp')}</div><div className="timer-actions"><button onClick={timer.status === 'running' ? pauseTimer : timer.status === 'awaitingStandUp' ? confirmStandUpTimer : startTimer}>{timer.status === 'running' ? t('timer.pause') : timer.status === 'paused' ? t('timer.resume') : timer.status === 'awaitingStandUp' ? t('timer.confirmStandUp') : t('timer.start')}</button><button onClick={skipTimer}>{t('timer.skip')}</button></div></div><PetAvatar language={settings.language} theme={settings.petTheme} visualState={visualState} size="medium" /></div>
        <FocusDurationSettings config={settings.focus} timerStatus={timer.status} onSave={(focus) => patchSettings({ focus })} />
      </div><TipsLyrics /></section>
      {reminderMessage && <div className="dashboard-reminder" role="status">{reminderMessage}<button aria-label={t('pet.closeReminder')} onClick={() => setReminderMessage(null)}>×</button></div>}
      <TodoListPanel heading={currentViewLabel} todos={filteredTodos} groups={groups} search={search} onSearchChange={setSearch} onToggle={toggleTodo} onStar={starTodo} onEdit={(todo) => setEditor({ open: true, todo })} onDelete={removeTodo} onAdd={() => setEditor({ open: true })} onMoveToGroup={moveTodoToGroup} onCreateGroup={openGroupManager} />
      {petWindowError && <div className="inline-error" role="alert">{petWindowError}<button type="button" onClick={() => setPetWindowError(null)} aria-label={t('pet.closeError')}>×</button></div>}
      {showPetPreview && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowPetPreview(false); }}><section className="modal" style={{ width: 340, textAlign: 'center' }}><div className="modal-header"><div><h2>{t('pet.previewTitle')}</h2><p>{t('pet.previewHint')}</p></div><button className="icon-button" onClick={() => setShowPetPreview(false)} aria-label={t('common.close')}>×</button></div><PetBubble compact>{tip}</PetBubble><PetAvatar language={settings.language} theme={settings.petTheme} visualState={visualState} size="large" /><button className="pill-button primary-button" onClick={() => setShowPetPreview(false)}>{t('pet.acknowledge')}</button></section></div>}
      {editor.open && <TodoEditor groups={groups} initialTodo={editor.todo} onSave={saveTodo} onRequestCreateGroup={() => openGroupManager()} onDelete={removeTodo} onClose={() => setEditor({ open: false })} />}
      {showGroups && <GroupEditor groups={groups} onAdd={addGroup} onRename={renameGroup} onDelete={removeGroup} onClose={() => { setGroupTargetTodoId(null); setShowGroups(false); }} />}
      {showSettings && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowSettings(false); }}><section className="modal" aria-label={t('settings.title')}><div className="modal-header"><div><h2>{t('settings.title')}</h2><p>{t('settings.subtitle')}</p></div><button className="icon-button" onClick={() => setShowSettings(false)} aria-label={t('common.close')}>×</button></div><AppearanceSettings settings={settings} onChange={patchSettings} /><TodoSyncSettings settings={settings} status={todoSyncStatus} onChange={patchSettings} onSyncNow={() => void syncTodoFile()} onUseDefaultPath={() => { void getDefaultTodoSyncPath().then((path) => { if (path) patchSettings({ todoSyncPath: path, todoSyncEnabled: true }); else setTodoSyncStatus(t('sync.portableOnly')); }); }} /><div className="modal-footer"><button className="save" onClick={() => setShowSettings(false)}>{t('settings.saveReturn')}</button></div></section></div>}
    </main></div></div>;
}

function resolveTheme(mode: AppSettings['themeMode']): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

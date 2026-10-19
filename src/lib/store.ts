import { create } from 'zustand';
import { produce } from 'immer';
import type { BackupEntry, Project, ProjectMeta, VarValue } from '../types';
import { createDefaultProject } from '../data/defaults';
import { applyDemo, clearDemo } from '../data/demo';
import { uid } from './format';
import { buildContext, resolveText } from '../engine/context';
import * as storage from './storage';
import { makeExport, parseExport } from './migrate';
import { downloadText } from './download';

export type SaveStatus = 'saved' | 'saving' | 'dirty' | 'error';

const HISTORY_LIMIT = 100;
const COALESCE_MS = 1200;
const SAVE_DEBOUNCE_MS = 500;
const AUTO_BACKUP_EVERY_MS = 60 * 60 * 1000;

interface AppState {
  ready: boolean;
  initError: string | null;
  project: Project;
  projects: ProjectMeta[];
  backups: BackupEntry[];
  saveStatus: SaveStatus;
  saveError: string | null;
  lastSavedAt: string | null;
  past: Project[];
  future: Project[];

  init: () => Promise<void>;
  update: (mutator: (draft: Project) => void, coalesceKey?: string) => void;
  setVar: (key: string, value: VarValue) => void;
  undo: () => void;
  redo: () => void;
  flush: () => Promise<void>;

  newProject: () => Promise<void>;
  cloneProject: () => Promise<void>;
  switchProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  resetProject: () => Promise<void>;
  importProject: (text: string) => Promise<void>;
  exportProject: () => void;

  createBackup: (label: string) => Promise<void>;
  restoreBackup: (id: string) => Promise<void>;
  removeBackup: (id: string) => Promise<void>;
  loadDemo: () => void;
  removeDemo: () => void;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let lastKey: string | null = null;
let lastAt = 0;

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export const useStore = create<AppState>((set, get) => {
  const persist = async (): Promise<void> => {
    const snapshot = get().project;
    set({ saveStatus: 'saving' });
    try {
      await storage.saveProject(snapshot);
      const backups = get().backups;
      if (!backups[0] || Date.now() - new Date(backups[0].at).getTime() > AUTO_BACKUP_EVERY_MS) {
        const next = await storage.addBackup(snapshot.id, {
          id: uid('bk'),
          at: new Date().toISOString(),
          label: 'نسخة تلقائية',
          project: snapshot,
        });
        set({ backups: next });
      }
      const projects = await storage.listProjects();
      set({
        projects,
        saveStatus: get().project === snapshot ? 'saved' : 'dirty',
        saveError: null,
        lastSavedAt: new Date().toISOString(),
      });
    } catch (e) {
      set({ saveStatus: 'error', saveError: `تعذر الحفظ المحلي: ${errMsg(e)}` });
    }
  };

  const scheduleSave = (): void => {
    set({ saveStatus: 'dirty' });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void persist(), SAVE_DEBOUNCE_MS);
  };

  /** يستبدل المشروع الحالي كاملًا مع إبقاء التراجع ممكنًا */
  const replace = (next: Project): void => {
    const { project, past } = get();
    set({ project: next, past: [...past, project].slice(-HISTORY_LIMIT), future: [] });
    lastKey = null;
    scheduleSave();
  };

  const activate = async (p: Project): Promise<void> => {
    await storage.saveProject(p);
    await storage.setActiveId(p.id);
    set({
      project: p,
      projects: await storage.listProjects(),
      backups: await storage.listBackups(p.id),
      past: [],
      future: [],
      saveStatus: 'saved',
      saveError: null,
    });
    lastKey = null;
  };

  const backupNow = async (label: string): Promise<void> => {
    const p = get().project;
    const next = await storage.addBackup(p.id, { id: uid('bk'), at: new Date().toISOString(), label, project: p });
    set({ backups: next });
  };

  return {
    ready: false,
    initError: null,
    project: createDefaultProject(),
    projects: [],
    backups: [],
    saveStatus: 'saved',
    saveError: null,
    lastSavedAt: null,
    past: [],
    future: [],

    init: async () => {
      try {
        const id = await storage.getActiveId();
        const loaded = id ? await storage.loadProject(id) : undefined;
        const p = loaded ?? createDefaultProject();
        await activate(p);
        set({ ready: true, initError: null });
      } catch (e) {
        set({ ready: false, initError: errMsg(e) });
      }
    },

    update: (mutator, coalesceKey) => {
      const { project, past } = get();
      const next = produce(project, (d) => {
        mutator(d);
        d.updatedAt = new Date().toISOString();
      });
      if (next === project) return;
      const now = Date.now();
      const merge = coalesceKey != null && coalesceKey === lastKey && now - lastAt < COALESCE_MS;
      set({ project: next, past: merge ? past : [...past, project].slice(-HISTORY_LIMIT), future: [] });
      lastKey = coalesceKey ?? null;
      lastAt = now;
      scheduleSave();
    },

    setVar: (key, value) => get().update((d) => void (d.vars[key] = value), `var:${key}`),

    undo: () => {
      const { past, project, future } = get();
      if (past.length === 0) return;
      set({ project: past[past.length - 1], past: past.slice(0, -1), future: [project, ...future] });
      lastKey = null;
      scheduleSave();
    },

    redo: () => {
      const { past, project, future } = get();
      if (future.length === 0) return;
      set({ project: future[0], past: [...past, project], future: future.slice(1) });
      lastKey = null;
      scheduleSave();
    },

    flush: async () => {
      clearTimeout(saveTimer);
      if (get().saveStatus === 'dirty') await persist();
    },

    newProject: async () => {
      await get().flush();
      await activate(createDefaultProject());
    },

    cloneProject: async () => {
      await get().flush();
      const src = get().project;
      const copy: Project = {
        ...(JSON.parse(JSON.stringify(src)) as Project),
        id: uid('proj'),
        name: `نسخة من ${resolveText(src.name, buildContext(src))}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await activate(copy);
    },

    switchProject: async (id) => {
      await get().flush();
      const p = await storage.loadProject(id);
      if (!p) throw new Error('المشروع غير موجود في هذا المتصفح.');
      await activate(p);
    },

    deleteProject: async (id) => {
      if (get().projects.length <= 1) throw new Error('لا يمكن حذف المشروع الوحيد. أنشئ مشروعًا آخر أولًا.');
      const wasActive = get().project.id === id;
      await storage.deleteProject(id);
      if (wasActive) {
        const rest = await storage.listProjects();
        const p = await storage.loadProject(rest[0].id);
        await activate(p as Project);
      } else {
        set({ projects: await storage.listProjects() });
      }
    },

    resetProject: async () => {
      await backupNow('قبل إعادة الضبط');
      const cur = get().project;
      replace({ ...createDefaultProject(), id: cur.id, createdAt: cur.createdAt });
    },

    importProject: async (text) => {
      const incoming = parseExport(text);
      await get().flush();
      // يُستورد دائمًا مشروعًا جديدًا حتى لا يُكتب فوق مشروع قائم
      await activate({ ...incoming, id: uid('proj'), updatedAt: new Date().toISOString() });
    },

    exportProject: () => {
      const p = get().project;
      const stamp = new Date().toISOString().slice(0, 10);
      downloadText(JSON.stringify(makeExport(p), null, 2), `family-fund-project-${stamp}.json`, 'application/json;charset=utf-8');
    },

    createBackup: async (label) => {
      await backupNow(label || 'نسخة يدوية');
    },

    restoreBackup: async (id) => {
      const b = get().backups.find((x) => x.id === id);
      if (!b) throw new Error('النسخة غير موجودة.');
      await backupNow('قبل الاستعادة');
      const cur = get().project;
      replace({ ...b.project, id: cur.id });
    },

    removeBackup: async (id) => {
      set({ backups: await storage.removeBackup(get().project.id, id) });
    },

    loadDemo: () => get().update((d) => Object.assign(d, applyDemo(d))),
    removeDemo: () => get().update((d) => Object.assign(d, clearDemo(d))),
  };
});

/** حفظ فوري عند إغلاق الصفحة أو إخفائها */
export const installFlushOnExit = (): void => {
  const flush = (): void => void useStore.getState().flush();
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
};

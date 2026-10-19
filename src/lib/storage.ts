import { createStore, del, get, set } from 'idb-keyval';
import type { BackupEntry, Project, ProjectMeta } from '../types';
import { migrateProject } from './migrate';

// التخزين المحلي الدائم في IndexedDB على هذا الجهاز فقط. لا يُرسل شيء إلى أي خادم.

const db = createStore('family-fund-charter', 'kv');

const INDEX = 'index';
const ACTIVE = 'active';
export const MAX_BACKUPS = 30;

const projectKey = (id: string): string => `project:${id}`;
const backupsKey = (id: string): string => `backups:${id}`;

export const listProjects = async (): Promise<ProjectMeta[]> => (await get<ProjectMeta[]>(INDEX, db)) ?? [];

export const loadProject = async (id: string): Promise<Project | undefined> => {
  const raw = await get<unknown>(projectKey(id), db);
  return raw === undefined ? undefined : migrateProject(raw);
};

export const saveProject = async (p: Project): Promise<void> => {
  await set(projectKey(p.id), p, db);
  const list = await listProjects();
  const meta: ProjectMeta = { id: p.id, name: p.name, updatedAt: p.updatedAt };
  const next = list.some((m) => m.id === p.id) ? list.map((m) => (m.id === p.id ? meta : m)) : [...list, meta];
  await set(INDEX, next, db);
};

export const deleteProject = async (id: string): Promise<void> => {
  await del(projectKey(id), db);
  await del(backupsKey(id), db);
  await set(INDEX, (await listProjects()).filter((m) => m.id !== id), db);
};

export const getActiveId = (): Promise<string | undefined> => get<string>(ACTIVE, db);
export const setActiveId = (id: string): Promise<void> => set(ACTIVE, id, db);

export const listBackups = async (id: string): Promise<BackupEntry[]> => (await get<BackupEntry[]>(backupsKey(id), db)) ?? [];

export const addBackup = async (id: string, entry: BackupEntry): Promise<BackupEntry[]> => {
  const next = [entry, ...(await listBackups(id))].slice(0, MAX_BACKUPS);
  await set(backupsKey(id), next, db);
  return next;
};

export const removeBackup = async (id: string, backupId: string): Promise<BackupEntry[]> => {
  const next = (await listBackups(id)).filter((b) => b.id !== backupId);
  await set(backupsKey(id), next, db);
  return next;
};

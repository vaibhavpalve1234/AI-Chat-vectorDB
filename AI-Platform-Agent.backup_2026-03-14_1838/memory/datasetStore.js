// ============================================================
//  memory/datasetStore.js — Dataset & Eval Result Store
// ============================================================
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { uuid, now }     from '../shared/utils.js';

const __dir      = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = path.resolve(__dir, '../data');
const DATASETS   = path.join(DATA_DIR, 'datasets');
const EVALS_DIR  = path.join(DATA_DIR, 'evals');
const HISTORY    = path.join(DATA_DIR, 'history.json');

export function initDatasetStore() {
  [DATASETS, EVALS_DIR, path.join(DATA_DIR, 'workspace')].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

// ─── History ──────────────────────────────────────────────

export function saveHistory(entry) {
  const all = loadHistory();
  all.unshift({ ...entry, id: entry.id || uuid(), timestamp: entry.timestamp || now() });
  fs.writeFileSync(HISTORY, JSON.stringify(all.slice(0, 500), null, 2), 'utf-8');
}

export function loadHistory(limit = 50) {
  try {
    if (!fs.existsSync(HISTORY)) return [];
    return JSON.parse(fs.readFileSync(HISTORY, 'utf-8')).slice(0, limit);
  } catch { return []; }
}

// ─── Datasets ─────────────────────────────────────────────

export function saveDataset(dataset) {
  const name = (dataset.name || dataset.id || uuid()).replace(/\s+/g, '_');
  const file = path.join(DATASETS, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(dataset, null, 2), 'utf-8');
  return file;
}

export function loadDataset(name) {
  const file = path.join(DATASETS, `${name}.json`);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return null; }
}

export function listDatasets() {
  if (!fs.existsSync(DATASETS)) return [];
  return fs.readdirSync(DATASETS)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const d = JSON.parse(fs.readFileSync(path.join(DATASETS, f), 'utf-8'));
        return { name: d.name, count: d.count || d.items?.length, timestamp: d.timestamp };
      } catch { return null; }
    }).filter(Boolean);
}

// ─── Evals ────────────────────────────────────────────────

export function saveEval(category, data) {
  const file = path.join(EVALS_DIR, `${category}.json`);
  const arr  = loadEvals(category);
  arr.unshift(data);
  fs.writeFileSync(file, JSON.stringify(arr.slice(0, 200), null, 2), 'utf-8');
}

export function loadEvals(category, limit = 20) {
  const file = path.join(EVALS_DIR, `${category}.json`);
  try {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf-8')).slice(0, limit);
  } catch { return []; }
}

// ─── Stats ────────────────────────────────────────────────

export function getStats() {
  return {
    historyCount:  loadHistory(500).length,
    datasetCount:  listDatasets().length,
    evalCategories: fs.existsSync(EVALS_DIR)
      ? fs.readdirSync(EVALS_DIR).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''))
      : [],
  };
}
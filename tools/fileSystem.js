// ============================================================
//  tools/fileSystem.js — Sandboxed File System Tool
//  All ops restricted to data/ directory
// ============================================================
import fs            from 'fs';
import path          from 'path';
import { fileURLToPath } from 'url';
import { registerTool }  from './index.js';
import { log }           from '../shared/logger.js';

const __dir    = path.dirname(fileURLToPath(import.meta.url));
const SANDBOX  = path.resolve(__dir, '../data/workspace');

if (!fs.existsSync(SANDBOX)) fs.mkdirSync(SANDBOX, { recursive: true });

function safePath(filePath) {
  const resolved = path.resolve(SANDBOX, filePath.replace(/^\/+/, ''));
  if (!resolved.startsWith(SANDBOX)) throw new Error('Path traversal blocked');
  return resolved;
}

export function readFile(filePath) {
  const p = safePath(filePath);
  if (!fs.existsSync(p)) throw new Error(`File not found: ${filePath}`);
  return { content: fs.readFileSync(p, 'utf-8'), path: filePath };
}

export function writeFile(filePath, content) {
  const p = safePath(filePath);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf-8');
  log.tool('fileSystem', `wrote ${filePath} (${content.length} bytes)`);
  return { success: true, path: filePath, bytes: content.length };
}

export function listFiles(dir = '') {
  const p = safePath(dir);
  if (!fs.existsSync(p)) return { files: [] };
  const entries = fs.readdirSync(p, { withFileTypes: true });
  return {
    files: entries.map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'dir' : 'file',
      path: path.join(dir, e.name),
    })),
  };
}

export function deleteFile(filePath) {
  const p = safePath(filePath);
  if (!fs.existsSync(p)) throw new Error(`File not found: ${filePath}`);
  fs.unlinkSync(p);
  return { success: true, path: filePath };
}

export function appendFile(filePath, content) {
  const p = safePath(filePath);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, content, 'utf-8');
  return { success: true, path: filePath };
}

registerTool({
  name: 'file_read',
  description: 'Read a file from the workspace',
  schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  execute: ({ path: p }) => readFile(p),
});

registerTool({
  name: 'file_write',
  description: 'Write content to a file in the workspace',
  schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
  execute: ({ path: p, content }) => writeFile(p, content),
});

registerTool({
  name: 'file_list',
  description: 'List files in a workspace directory',
  schema: { type: 'object', properties: { dir: { type: 'string' } } },
  execute: ({ dir = '' }) => listFiles(dir),
});

registerTool({
  name: 'file_delete',
  description: 'Delete a file from the workspace',
  schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  execute: ({ path: p }) => deleteFile(p),
});
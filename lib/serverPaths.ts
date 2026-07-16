import fs from 'fs';
import os from 'os';
import path from 'path';

// Serverio failų API saugiklis: skaityti/trinti leidžiama TIK projektų aplankuose.

const CONFIG_PATH = path.join(os.homedir(), '.openclaw-config.json');

export function allowedRoots(): string[] {
  const roots = [path.join(os.homedir(), 'Documents', 'KA_projektai')];
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const base = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')).basePath;
      if (base) roots.push(base);
    }
  } catch {}
  return roots.map(r => path.resolve(r));
}

export function isAllowedPath(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return allowedRoots().some(root => resolved.startsWith(root + path.sep));
}

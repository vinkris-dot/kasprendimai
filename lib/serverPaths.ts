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

/** Projektų šakninis aplankas (iš ~/.openclaw-config.json arba numatytasis). */
export function getBasePath(): string {
  try {
    if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')).basePath;
  } catch {}
  return path.join(os.homedir(), 'Documents', 'KA_projektai');
}

const LT_MAP: Record<string, string> = {
  ą: 'a', č: 'c', ę: 'e', ė: 'e', į: 'i', š: 's', ų: 'u', ū: 'u', ž: 'z',
  Ą: 'A', Č: 'C', Ę: 'E', Ė: 'E', Į: 'I', Š: 'S', Ų: 'U', Ū: 'U', Ž: 'Z',
};
export const beLietuvisku = (s: string) => s.replace(/[ąčęėįšųūžĄČĘĖĮŠŲŪŽ]/g, c => LT_MAP[c] ?? c);

/**
 * VIENINTELĖ projekto aplanko vardo taisyklė — naudoja ir create-folder, ir
 * upload: be lietuviškų raidžių, be draudžiamų simbolių. Skirtingos taisyklės
 * anksčiau kūrė du aplankus tam pačiam projektui („Žemaičių..." ir „Zemaiciu...").
 */
export const saugusVardas = (s: string) =>
  beLietuvisku(s).replace(/[/\\:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();

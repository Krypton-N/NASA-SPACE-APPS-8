import { esc, option } from './ui.js';

/**
 * How the PSI investigations are grouped for navigation: combustion family → flight program.
 * Taken from the campaign table (data/clean/campaigns.csv). It only organizes the library; studies
 * in the same group are not scientifically equivalent. Unknown identifiers fall into "Other".
 */
export const FAMILIES = [
  { key: 'droplets', label: 'Droplets', blurb: 'Isolated fuel droplets burning in the Multi-user Droplet Combustion Apparatus.', programs: [
    { key: 'flex', label: 'FLEX', ids: ['psi-69', 'psi-68'] },
    { key: 'cfi', label: 'Cool flames', ids: ['psi-39', 'psi-117', 'psi-142'] },
  ] },
  { key: 'gas', label: 'Gas flames', blurb: 'Laminar, coflow and spherical flames of gaseous fuels.', programs: [
    { key: 'acme', label: 'ACME', ids: ['psi-10', 'psi-20', 'psi-21', 'psi-22', 'psi-23', 'psi-159'] },
    { key: 'spice', label: 'SPICE', ids: ['psi-107', 'psi-60'] },
    { key: 'slice', label: 'SLICE', ids: ['psi-106'] },
  ] },
  { key: 'solids', label: 'Solids', blurb: 'Flame spread over fabrics, PMMA and other spacecraft materials.', programs: [
    { key: 'bass', label: 'BASS', ids: ['psi-26', 'psi-25', 'psi-62'] },
    { key: 'saffire', label: 'Saffire', ids: ['psi-98', 'psi-99', 'psi-100'] },
  ] },
  { key: 'aerosols', label: 'Aerosols & smoke', blurb: 'Smoke and dust particles measured for fire detection.', programs: [
    { key: 'same', label: 'SAME', ids: ['psi-102', 'psi-101', 'psi-115'] },
    { key: 'daft', label: 'DAFT', ids: ['psi-47'] },
  ] },
];

const PLATFORMS = {
  CIR: ['psi-142', 'psi-117', 'psi-39', 'psi-159', 'psi-22', 'psi-21', 'psi-20', 'psi-23', 'psi-10', 'psi-69', 'psi-68'],
  MSG: ['psi-62', 'psi-60', 'psi-26', 'psi-106', 'psi-115', 'psi-102', 'psi-101', 'psi-25', 'psi-107'],
  Cygnus: ['psi-98', 'psi-99', 'psi-100'],
  Mir: ['psi-47'],
};
const PLATFORM_LABEL = { CIR: 'ISS · Combustion Integrated Rack', MSG: 'ISS · Microgravity Science Glovebox', Cygnus: 'Cygnus cargo vehicle', Mir: 'Mir space station' };

const index = new Map();
for (const family of FAMILIES) for (const program of family.programs) for (const id of program.ids) index.set(id, { family, program });

/** Family, program and platform of an investigation id (or nulls when it is not mapped). */
export function placeOf(id) {
  const hit = index.get(String(id).toLowerCase());
  const platform = Object.keys(PLATFORMS).find(k => PLATFORMS[k].includes(String(id).toLowerCase()));
  return { family: hit?.family || null, program: hit?.program || null, platform: platform ? { key: platform, label: PLATFORM_LABEL[platform] } : null };
}

/** Readable title: drops the long shared "Advanced Combustion via Microgravity Experiments" prefix. */
export function shortTitle(title = '') {
  const short = String(title).replace(/^Advanced Combustion via Microgravity Experiments\s*[-–/]?\s*/i, '');
  return short ? (short === title ? short : 'ACME · ' + short) : title;
}

/** Investigations grouped as [{family, count, programs:[{program, items}]}], keeping library order inside a program. */
export function groupInvestigations(items) {
  const groups = FAMILIES.map(family => ({ family, programs: family.programs.map(program => ({ program, items: [] })) }));
  const other = { family: { key: 'other', label: 'Other', blurb: 'Investigations without a family assignment.', programs: [] }, programs: [{ program: { key: 'other', label: 'Other' }, items: [] }] };
  for (const item of items) {
    const { family, program } = placeOf(item.id);
    const group = family ? groups.find(g => g.family === family) : other;
    const slot = family ? group.programs.find(p => p.program === program) : other.programs[0];
    slot.items.push(item);
  }
  return [...groups, other]
    .map(g => ({ ...g, programs: g.programs.filter(p => p.items.length), count: g.programs.reduce((n, p) => n + p.items.length, 0) }))
    .filter(g => g.count);
}

/** <option>s grouped by family, for investigation selectors (Compare, Discover). */
export function investigationOptions(items, selected) {
  return groupInvestigations(items).map(g => `<optgroup label="${esc(g.family.label)}">${g.programs.flatMap(p => p.items).map(s => option(s.id, `${s.id.toUpperCase()} · ${shortTitle(s.title)}`, selected)).join('')}</optgroup>`).join('');
}

import { readFile, appendFile } from 'node:fs/promises';

function safeSummary(data) {
  if (!data || typeof data !== 'object' || !data.metadata?.vulnerabilities) return null;
  const values = data.metadata.vulnerabilities;
  return {
    critical: Number(values.critical || 0),
    high: Number(values.high || 0),
    moderate: Number(values.moderate || 0),
    low: Number(values.low || 0),
    total: Number(values.total || 0),
  };
}
const filePairs = [
  ['Frontend runtime', process.argv[2]],
  ['Functions runtime', process.argv[3]],
];
const rows = [];
for (const [name, filename] of filePairs) {
  let summary = null;
  try { summary = safeSummary(JSON.parse(await readFile(filename, 'utf8'))); }
  catch { /* A missing audit report must never be counted as zero vulnerabilities. */ }
  rows.push({ name, summary });
}
const markdown = [
  '## Dependency audit — runtime only',
  '',
  '| Package | Critical | High | Moderate | Low | Total |',
  '|---|---:|---:|---:|---:|---:|',
  ...rows.map(({ name, summary }) => summary
    ? '| ' + name + ' | ' + summary.critical + ' | ' + summary.high + ' | ' + summary.moderate + ' | ' + summary.low + ' | ' + summary.total + ' |'
    : '| ' + name + ' | INDISPONÍVEL | — | — | — | — |'),
  '',
  'A green CI does not make unresolved vulnerabilities safe to release.',
  '',
].join('\n');
console.log(markdown);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);

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
  let notable = [];
  try {
    const report = JSON.parse(await readFile(filename, 'utf8'));
    summary = safeSummary(report);
    notable = Object.entries(report.vulnerabilities || {})
      .filter(([, value]) => ['high', 'critical'].includes(value?.severity))
      .map(([pkg, value]) => ({
        pkg,
        severity: value.severity,
        direct: value.isDirect === true ? 'sim' : 'não',
        fix: value.fixAvailable === false ? 'sem fix automatizado'
          : value.fixAvailable === true ? 'compatível sugerido'
          : value.fixAvailable?.version || 'revisar',
      }));
  } catch { /* A missing audit report must never be counted as zero vulnerabilities. */ }
  rows.push({ name, summary, notable });
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
  '### Vulnerabilidades altas/críticas que exigem revisão',
  '',
  '| Área | Dependência | Severidade | Direta | Fix disponível |',
  '|---|---|---|---|---|',
  ...rows.flatMap(({ name, notable }) => notable.map((x) =>
    '| ' + name + ' | ' + x.pkg + ' | ' + x.severity + ' | ' + x.direct + ' | ' + x.fix + ' |')),
  '',
  'A green CI does not make unresolved vulnerabilities safe to release.',
  '',
].join('\n');
console.log(markdown);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);

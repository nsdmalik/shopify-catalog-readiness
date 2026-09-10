#!/usr/bin/env node
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { auditCatalog, renderMarkdown } from './audit.mjs';

const help = `Usage: node src/cli.mjs <catalog.json> [options]

Offline Shopify catalog audit. Nothing is sent to a store or model.

  --format markdown|json       Output format (default: markdown)
  --output <path>               Write a new report file (never overwrite)
  --fail-on error|warning|never CI gate (default: never)
  --min-score <0..100>          Exit 1 below this score
  --min-description-words <n>  Content threshold (default: 40)
  --help                       Show this help

Exit codes: 0 completed / gate passed; 1 gate failed; 2 invalid input or I/O.
Input limit: 10 MiB. See docs/input-format.md for snapshot requirements.
`;

function main(args) {
  if (args.includes('--help')) { process.stdout.write(help); return 0; }
  const options = { format: 'markdown', failOn: 'never' };
  let input;
  const seen = new Set();
  const names = { '--format': 'format', '--output': 'output', '--fail-on': 'failOn', '--min-score': 'minScore', '--min-description-words': 'minDescriptionWords' };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      if (!(arg in names)) throw new Error(`Unknown option: ${arg}`);
      if (seen.has(arg)) throw new Error(`Repeated option: ${arg}`);
      seen.add(arg);
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      options[names[arg]] = value;
    } else if (input) throw new Error('Provide exactly one input file');
    else input = arg;
  }
  if (!input) throw new Error('Provide a catalog JSON file. Use --help for usage.');
  if (!['markdown', 'json'].includes(options.format)) throw new Error('Format must be markdown or json');
  if (!['error', 'warning', 'never'].includes(options.failOn)) throw new Error('fail-on must be error, warning, or never');
  if (options.minScore !== undefined) {
    if (!/^\d+(?:\.\d+)?$/.test(options.minScore) || Number(options.minScore) > 100) throw new Error('min-score must be a number between 0 and 100');
    options.minScore = Number(options.minScore);
  }
  if (options.minDescriptionWords !== undefined) {
    if (!/^\d+$/.test(options.minDescriptionWords)) throw new Error('min-description-words must be an integer');
    options.minDescriptionWords = Number(options.minDescriptionWords);
  }
  if (options.output && resolve(options.output) === resolve(input)) throw new Error('Output must not replace the input catalog');
  const stat = statSync(input);
  if (!stat.isFile() || stat.size > 10 * 1024 * 1024) throw new Error('Input must be a regular JSON file no larger than 10 MiB');
  const raw = readFileSync(input, 'utf8');
  let catalog;
  try { catalog = JSON.parse(raw.replace(/^\uFEFF/, '')); }
  catch { throw new Error('Input is not valid JSON'); }
  const report = auditCatalog(catalog, { minDescriptionWords: options.minDescriptionWords });
  const output = options.format === 'json' ? JSON.stringify(report, null, 2) + '\n' : renderMarkdown(report);
  if (options.output) writeFileSync(options.output, output, { flag: 'wx' });
  else process.stdout.write(output);
  const s = report.summary;
  return ((options.failOn !== 'never' && s.errors > 0)
    || (options.failOn === 'warning' && s.warnings > 0)
    || (options.minScore !== undefined && s.score < options.minScore)) ? 1 : 0;
}

try { process.exitCode = main(process.argv.slice(2)); }
catch (error) { process.stderr.write(`catalog-readiness: ${error.message}\n`); process.exitCode = 2; }

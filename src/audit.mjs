/** Pure audit engine. No network calls, store writes, model calls, or telemetry. */
export const RULESET_VERSION = '1.0';
export const DEFAULT_DESCRIPTION_WORDS = 40;

export class InputError extends Error {
  constructor(message) { super(message); this.name = 'InputError'; }
}

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const present = value => typeof value === 'string' && value.trim().length > 0;
const fail = message => { throw new InputError(message); };

function textField(value, path) {
  if (value !== undefined && value !== null && typeof value !== 'string') fail(`${path} must be a string or null`);
  return value ?? '';
}

function connection(value, path) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  if (!object(value)) fail(`${path} must be an array or GraphQL connection`);
  if (value.pageInfo?.hasNextPage === true) fail(`${path} is incomplete: fetch all pages before auditing`);
  if (Array.isArray(value.nodes)) return value.nodes;
  if (Array.isArray(value.edges) && value.edges.every(edge => object(edge) && object(edge.node))) {
    return value.edges.map(edge => edge.node);
  }
  fail(`${path} must contain nodes or edges`);
}

/** Accept the documented snapshot shape or a Shopify GraphQL products response. */
export function normalizeCatalog(input) {
  if (!object(input)) fail('Input must be an object containing products');
  if (Array.isArray(input.errors) && input.errors.length) fail('GraphQL response contains errors; provide a complete successful export');
  const root = object(input.data) ? input.data : input;
  if (!('products' in root) || root.products == null) fail('Input must contain products');
  const products = connection(root.products, 'products');
  if (!products.length) fail('Catalog is empty; provide at least one product');
  const ids = new Set();
  return products.map((p, index) => {
    const path = `products[${index}]`;
    if (!object(p)) fail(`${path} must be an object`);
    if (!present(p.id)) fail(`${path}.id must be a nonempty string`);
    if (ids.has(p.id.trim())) fail(`${path}.id is duplicated`);
    ids.add(p.id.trim());
    if (p.gtinRequired !== undefined && typeof p.gtinRequired !== 'boolean') fail(`${path}.gtinRequired must be a boolean`);
    if (p.seo != null && !object(p.seo)) fail(`${path}.seo must be an object`);
    const images = connection(p.images, `${path}.images`).map((im, i) => {
      if (!object(im)) fail(`${path}.images[${i}] must be an object`);
      return { url: textField(im.url, `${path}.images[${i}].url`), altText: textField(im.altText, `${path}.images[${i}].altText`) };
    });
    const variants = connection(p.variants, `${path}.variants`).map((v, i) => {
      if (!object(v)) fail(`${path}.variants[${i}] must be an object`);
      if (v.price != null && !['string', 'number'].includes(typeof v.price)) fail(`${path}.variants[${i}].price must be a decimal string or number`);
      return { sku: textField(v.sku, `${path}.variants[${i}].sku`), barcode: textField(v.barcode, `${path}.variants[${i}].barcode`), price: v.price ?? null };
    });
    return {
      id: p.id.trim(),
      title: textField(p.title, `${path}.title`),
      descriptionHtml: textField(p.descriptionHtml, `${path}.descriptionHtml`),
      vendor: textField(p.vendor, `${path}.vendor`),
      productType: textField(p.productType, `${path}.productType`),
      images, variants, gtinRequired: p.gtinRequired ?? false,
      seo: { title: textField(p.seo?.title, `${path}.seo.title`), description: textField(p.seo?.description, `${path}.seo.description`) },
    };
  });
}

/** Validate format and GS1 check digit, not ownership or official registration. */
export function isValidGtin(value) {
  if (typeof value !== 'string' || !/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value) || /^0+$/.test(value)) return false;
  const body = value.slice(0, -1).split('').reverse();
  const sum = body.reduce((total, digit, i) => total + Number(digit) * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - sum % 10) % 10 === Number(value.at(-1));
}

function wordCount(html) {
  // Deliberately a heuristic for content quantity, not a full HTML renderer or semantic judge.
  const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[^]*?-->/g, ' ').replace(/<[^>]*>/g, ' ')
    .replace(/&(?:#\d+|#x[\da-f]+|[a-z]+);/gi, ' ');
  return (text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? []).length;
}

function httpUrl(value) {
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && !!u.hostname; }
  catch { return false; }
}

function validPrice(value) {
  return (typeof value === 'number' && Number.isFinite(value) && value >= 0)
    || (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim()));
}

export function auditCatalog(input, { minDescriptionWords = DEFAULT_DESCRIPTION_WORDS } = {}) {
  if (!Number.isInteger(minDescriptionWords) || minDescriptionWords < 1 || minDescriptionWords > 10000) fail('minDescriptionWords must be an integer between 1 and 10000');
  const products = normalizeCatalog(input);
  // Track all occurrences, including duplicates within one product. Case remains meaningful.
  const skus = new Map();
  for (const p of products) for (const v of p.variants) {
    if (present(v.sku)) skus.set(v.sku.trim(), (skus.get(v.sku.trim()) ?? 0) + 1);
  }
  const results = products.map(p => {
    const checks = [];
    const add = (rule, path, status, message, remediation = '', scored = true) => checks.push({ rule, path, status, scored: scored && status !== 'skip', message, remediation });
    const check = (rule, path, ok, message, remediation, severity = 'warning') => add(rule, path, ok ? 'pass' : severity, message, ok ? '' : remediation);
    check('title.present', 'title', present(p.title), present(p.title) ? 'Product title is present' : 'Product title is missing', 'Write a specific title that identifies the product.');
    const words = wordCount(p.descriptionHtml);
    check('description.depth', 'descriptionHtml', words >= minDescriptionWords, `${words} description words; configured threshold ${minDescriptionWords}`, 'Describe the product, material, intended use, and relevant specifications.');
    check('brand.present', 'vendor', present(p.vendor), present(p.vendor) ? 'Brand/vendor is present' : 'Brand/vendor is missing', 'Supply the correct product brand or vendor.');
    check('type.present', 'productType', present(p.productType), present(p.productType) ? 'Product type is present' : 'Product type is missing', 'Provide a consistent product type for this catalog.');
    check('images.present', 'images', p.images.length > 0, p.images.length ? 'Images are present' : 'No images supplied', 'Include product images in the snapshot.');
    p.images.forEach((im, i) => {
      check('image.url', `images[${i}].url`, httpUrl(im.url), httpUrl(im.url) ? 'HTTP(S) image URL is syntactically valid' : 'Image URL is missing or invalid', 'Provide an absolute HTTP(S) image URL.', 'error');
      check('image.alt', `images[${i}].altText`, present(im.altText), present(im.altText) ? 'Image alternative text is present' : 'Image alternative text is missing', 'Describe the image for people who cannot see it.');
    });
    check('variants.present', 'variants', p.variants.length > 0, p.variants.length ? 'Variants are present' : 'No variants supplied', 'Include all variants in the snapshot.');
    p.variants.forEach((v, i) => {
      const path = `variants[${i}]`;
      check('price.valid', `${path}.price`, validPrice(v.price), validPrice(v.price) ? 'Price is a nonnegative decimal' : 'Price is missing or invalid', 'Provide a nonnegative decimal price without currency symbols.', 'error');
      check('sku.present', `${path}.sku`, present(v.sku), present(v.sku) ? 'SKU is present' : 'SKU is missing', 'Provide a stable SKU for inventory and integration workflows.');
      if (present(v.sku)) check('sku.unique', `${path}.sku`, skus.get(v.sku.trim()) === 1, skus.get(v.sku.trim()) === 1 ? 'SKU is unique in this snapshot' : 'SKU is repeated in this snapshot', 'Confirm whether the shared SKU is intentional before changing it.');
      if (present(v.barcode)) check('gtin.checksum', `${path}.barcode`, isValidGtin(v.barcode.trim()), isValidGtin(v.barcode.trim()) ? 'GTIN format and check digit pass' : 'Barcode is not a valid GTIN format/check digit', 'Check the product identifier against its authoritative source. Do not invent a barcode.', 'error');
      else if (p.gtinRequired) add('gtin.required', `${path}.barcode`, 'warning', 'GTIN required by this snapshot policy but missing', 'Supply the assigned GTIN or confirm an applicable exemption.');
      else add('gtin.optional', `${path}.barcode`, 'skip', 'No barcode supplied; GTIN is not required by this snapshot policy');
    });
    for (const field of ['title', 'description']) {
      add(`seo.${field}`, `seo.${field}`, present(p.seo[field]) ? 'pass' : 'skip', present(p.seo[field]) ? `Explicit SEO ${field} is present` : `No explicit SEO ${field}; platform defaults may apply`, '', false);
    }
    const applicable = checks.filter(c => c.scored);
    const passed = applicable.filter(c => c.status === 'pass').length;
    return { id: p.id, title: p.title, score: Math.round(100 * passed / applicable.length), passed, applicable: applicable.length, checks };
  });
  const summary = { products: results.length, passed: 0, applicable: 0, errors: 0, warnings: 0, skipped: 0 };
  for (const p of results) {
    summary.passed += p.passed; summary.applicable += p.applicable;
    for (const c of p.checks) {
      if (c.status === 'error') summary.errors++;
      if (c.status === 'warning') summary.warnings++;
      if (c.status === 'skip') summary.skipped++;
    }
  }
  return {
    schemaVersion: '1.0', rulesetVersion: RULESET_VERSION,
    policy: { minDescriptionWords, scoring: 'Percentage of applicable scored checks that pass. Checks have equal weight; products with more variants/images contribute more checks.' },
    scope: 'Supplied snapshot only. No storefront crawl, image fetch, AI ranking prediction, or store modification.',
    summary: { ...summary, score: Math.round(100 * summary.passed / summary.applicable) },
    products: results,
  };
}

function md(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\r?\n/g, ' ').replace(/([\\`*_{}\[\]()|#!])/g, '\\$1');
}

export function renderMarkdown(report) {
  const s = report.summary;
  const lines = ['# Catalog readiness report', '', `**${s.score}/100** snapshot completeness and consistency`, '',
    `Products: ${s.products} · Errors: ${s.errors} · Warnings: ${s.warnings} · Skipped: ${s.skipped}`, '',
    `Ruleset: ${report.rulesetVersion}. ${report.scope}`, '',
    'This score describes the supplied data under a documented policy. It does not predict AI recommendations, search rankings, or sales.', '',
    '## Findings', '', '| Product | Level | Rule | Field | Finding | Next step |', '| --- | --- | --- | --- | --- | --- |'];
  let findings = 0;
  for (const p of report.products) for (const c of p.checks) {
    if (!['warning', 'error'].includes(c.status)) continue;
    findings++;
    lines.push(`| ${md(p.title || p.id)} | ${c.status} | ${md(c.rule)} | ${md(c.path)} | ${md(c.message)} | ${md(c.remediation)} |`);
  }
  if (!findings) lines.push('| All products | pass | | | No errors or warnings under this policy | |');
  lines.push('', '## Score calculation', '', `${s.passed} passing scored checks / ${s.applicable} applicable checks. Optional SEO overrides and skipped checks do not affect the score.`, '');
  return lines.join('\n');
}

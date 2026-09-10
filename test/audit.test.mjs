import test from 'node:test';
import assert from 'node:assert/strict';
import { auditCatalog, isValidGtin, normalizeCatalog, renderMarkdown } from '../src/audit.mjs';

function product(extra = {}) {
  return { id: 'sample:1', title: 'Trail canvas tote', descriptionHtml: '<p>' + 'canvas durable carry handle pocket travel washable practical everyday bag '.repeat(5) + '</p>', vendor: 'Sample Goods', productType: 'Tote bag', images: [{ url: 'https://example.com/tote.jpg', altText: 'Canvas tote with two handles' }], variants: [{ sku: 'TOTE-01', price: '29.00', barcode: '4006381333931' }], ...extra };
}
const catalog = (...products) => ({ products });

test('complete product earns full score; SEO defaults do not reduce it', () => {
 const r = auditCatalog(catalog(product()));
 assert.equal(r.summary.score, 100); assert.equal(r.summary.errors, 0); assert.equal(r.summary.warnings, 0);
 assert.equal(r.products[0].checks.find(c => c.rule === 'seo.title').scored, false);
});
test('price errors and missing fields have explicit paths and remedies', () => {
 const r = auditCatalog(catalog(product({ title: '', variants: [{ sku: '', price: '-2', barcode: '123' }] })));
 const checks = r.products[0].checks;
 assert.equal(checks.find(c => c.rule === 'title.present').status, 'warning');
 assert.equal(checks.find(c => c.rule === 'price.valid').path, 'variants[0].price');
 assert.equal(r.summary.errors, 2); assert.ok(checks.find(c => c.rule === 'gtin.checksum').remediation.includes('Do not invent'));
});
test('valid GTIN lengths and invalid checksums', () => {
 for (const gtin of ['96385074', '036000291452', '4006381333931', '10012345000017']) assert.equal(isValidGtin(gtin), true, gtin);
 for (const gtin of ['96385075', '00000000', '123', '4e12', 4006381333931, '4006381333931\n']) assert.equal(isValidGtin(gtin), false, String(gtin));
});
test('GTIN exemption is skipped; required missing GTIN is a warning', () => {
 const p = product({ variants: [{ sku: 'HANDMADE', price: 0 }] });
 assert.equal(auditCatalog(catalog(p)).summary.score, 100);
 assert.equal(auditCatalog(catalog({ ...p, gtinRequired: true })).summary.warnings, 1);
});
test('duplicate SKUs across products and variants are flagged; input is unchanged', () => {
 const input = catalog(product(), product({ id: 'sample:2' })); const before = JSON.stringify(input);
 assert.equal(auditCatalog(input).summary.warnings, 2); assert.equal(JSON.stringify(input), before);
 assert.equal(auditCatalog(catalog(product({ variants: [product().variants[0], product().variants[0]] }))).summary.warnings, 2);
});
test('description heuristic ignores markup, scripts, styles and comments', () => {
 const r = auditCatalog(catalog(product({ descriptionHtml: '<style>word '.repeat(1) + '</style><script>' + 'word '.repeat(50) + '</script><!-- hidden words --><p>&nbsp;Only three words</p>' })));
 assert.match(r.products[0].checks.find(c => c.rule === 'description.depth').message, /^3 description words/);
});
test('non-Latin words count and description threshold is configurable', () => {
 const r = auditCatalog(catalog(product({ descriptionHtml: '<p>مرحبا بالعالم</p>' })), { minDescriptionWords: 2 });
 assert.equal(r.summary.score, 100);
 for (const n of [0, -1, 1.2, NaN, 10001]) assert.throws(() => auditCatalog(catalog(product()), { minDescriptionWords: n }));
});
test('images are not fetched; invalid schemes and missing alt text are identified', () => {
 const r = auditCatalog(catalog(product({ images: [{ url: 'javascript:alert(1)', altText: '' }] })));
 assert.equal(r.summary.errors, 1); assert.equal(r.summary.warnings, 1);
});
test('GraphQL nodes and edges normalize equivalently', () => {
 const p = product(); const expected = normalizeCatalog(catalog(p));
 assert.deepEqual(normalizeCatalog({ data: { products: { edges: [{ node: { ...p, variants: { nodes: p.variants, pageInfo: { hasNextPage: false } }, images: { edges: p.images.map(node => ({ node })) } } }], pageInfo: { hasNextPage: false } } } }), expected);
});
test('incomplete paginated data and GraphQL errors fail closed', () => {
 assert.throws(() => auditCatalog({ data: { products: { nodes: [product()], pageInfo: { hasNextPage: true } } } }), /incomplete/);
 assert.throws(() => auditCatalog(catalog(product({ variants: { nodes: [], pageInfo: { hasNextPage: true } } }))), /incomplete/);
 assert.throws(() => auditCatalog({ errors: [{ message: 'throttled' }], data: { products: [product()] } }), /GraphQL response contains errors/);
});
test('invalid structure, ambiguous identity and coercions are rejected', () => {
 for (const input of [null, [], {}, {products:null}, {products:[]}, catalog(null), catalog({id:12}), catalog(product(),product()), catalog(product({title:{value:'bad'}})), catalog(product({gtinRequired:'false'})), catalog(product({images:[null]})), catalog(product({variants:[{barcode:123}]}))]) assert.throws(() => auditCatalog(input));
});
test('price parsing preserves zero but rejects non-decimal strings and non-finite numbers', () => {
 for (const price of ['0', '0.00', 0, '12.50', 12.5]) assert.equal(auditCatalog(catalog(product({variants:[{sku:'A',price}]}))).summary.errors, 0);
 for (const price of [null, '', '1e2', '-0.2', '12USD', Infinity, NaN]) assert.equal(auditCatalog(catalog(product({variants:[{sku:'A',price}]}))).summary.errors, 1);
});
test('score is weighted by applicable checks, never includes skipped SEO', () => {
 const r = auditCatalog(catalog(product(), product({id:'sample:2', title:'', variants:[]})));
 assert.equal(r.summary.score, Math.round(100 * r.summary.passed / r.summary.applicable));
 assert.ok(r.summary.score>=0 && r.summary.score<=100);
});
test('Markdown escapes untrusted product data', () => {
 const r = renderMarkdown(auditCatalog(catalog(product({title:'<script>alert(1)</script>|[click](https://example.com)\n# title',vendor:''}))));
 assert.ok(!r.includes('<script>')); assert.ok(r.includes('&lt;script&gt;')); assert.ok(r.includes('\\|')); assert.ok(r.includes('\\[click\\]'));
});
test('reports are deterministic', () => {
 const input = catalog(product({vendor:''})); assert.deepEqual(auditCatalog(input),auditCatalog(input));
});

test('Shopify MediaImage exports map to normalized images; video does not count as a product image', () => {
 const p = product(); delete p.images;
 p.media = { nodes: [{__typename:'MediaImage',alt:'Canvas tote',image:{url:'https://example.com/tote.jpg',altText:null}},{__typename:'Video'}],pageInfo:{hasNextPage:false} };
 assert.equal(auditCatalog(catalog(p)).summary.score,100);
 assert.equal(normalizeCatalog(catalog(p))[0].images.length,1);
});
test('unprocessed media and incomplete media exports are not treated as ready', () => {
 const p = product();delete p.images;
 p.media={nodes:[{__typename:'MediaImage',image:null}],pageInfo:{hasNextPage:false}};
 assert.equal(auditCatalog(catalog(p)).summary.errors,1);
 p.media.pageInfo.hasNextPage=true;assert.throws(()=>auditCatalog(catalog(p)),/incomplete/);
});
test('ambiguous or malformed media inputs fail before scoring', () => {
 assert.throws(()=>auditCatalog(catalog(product({media:{nodes:[]}}))),/images or media/);
 const p=product();delete p.images;p.media={nodes:[{}]};assert.throws(()=>auditCatalog(catalog(p)),/__typename/);
});

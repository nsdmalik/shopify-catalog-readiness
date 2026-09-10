# Shopify Catalog Readiness

**Find the product-data gaps before they become integration problems.**

An offline audit library and CLI for Shopify catalog snapshots. It checks content completeness, images, variant prices, SKU collisions, and GTIN check digits, then produces an explainable report with field-level findings and suggested next steps.

No dependencies. No API credentials. No store writes. Runs on Node.js 22 or later.

[Example report](examples/report.md) · [Input format](docs/input-format.md) · [Rules and scoring](docs/rules.md) · [Architecture](docs/architecture.md)

## Run it

```sh
git clone https://github.com/nsdmalik/shopify-catalog-readiness.git
cd shopify-catalog-readiness
node src/cli.mjs examples/catalog.json
```

No `npm install` is needed. The included catalog contains fictional products and deliberately inconsistent data.

```sh
# Machine-readable results
node src/cli.mjs examples/catalog.json --format json

# Gate your own complete snapshot on errors or a minimum score
node src/cli.mjs your-catalog.json --fail-on error --min-score 85

# Run the regression suite
npm test
```

The demo intentionally contains errors, so adding a quality gate to it will return a nonzero exit code. See [the CLI reference](docs/cli.md).

## What it catches

| Area | Examples |
| --- | --- |
| Product information | Missing titles, short descriptions, absent brand/vendor or product type |
| Images | Missing images, invalid URL schemes, missing alternative text |
| Variant data | Missing or invalid prices, missing SKUs, repeated SKUs across the snapshot |
| Product identifiers | Invalid GTIN lengths/check digits and policy-required missing GTINs |
| Export integrity | Duplicate product IDs, GraphQL errors, explicitly incomplete pagination, malformed field types |

Every finding includes a stable rule ID, a field path, severity, and a suggested next step. The JSON report includes passing and skipped checks as well, so a score can be reconstructed.

## Why this exists

A product can look fine in a storefront while carrying incomplete or ambiguous data into search, feeds, analytics, and AI-assisted discovery. This tool makes those gaps visible before adding another integration or generating more content.

The score measures **snapshot completeness and consistency under a documented policy**. It is not an AI search ranking, a Shopify certification, a measure of content truth, or a prediction of conversion. SEO overrides are informational because platform defaults can apply. GTIN checks validate syntax and check digits, not registration or brand ownership.

## Use the library

```js
import { auditCatalog, renderMarkdown } from './src/audit.mjs';

const report = auditCatalog(catalog, { minDescriptionWords: 40 });
console.log(report.summary);
console.log(renderMarkdown(report));
```

`catalog` must match the [input contract](docs/input-format.md). The library does not mutate input. Identical inputs and policy produce identical reports.

## Engineering decisions

- **Pure engine, thin CLI:** scoring and normalization are independently testable.
- **Explicit policy:** every scored check has equal weight; skipped and informational checks do not reduce the score.
- **Pagination awareness:** known incomplete exports are rejected instead of silently looking healthy.
- **Conservative identifiers:** missing optional GTINs are skipped; repeated SKUs are warnings because duplicates can be intentional.
- **Local data handling:** no outbound requests, telemetry, model calls, or writes to Shopify. Markdown output escapes product text.

## Scope

Version 0.1.0 works with documented JSON snapshots and Shopify GraphQL product connections. It does not fetch exports, parse Shopify CSV, crawl storefronts, verify image availability, modify products, or call an LLM. The description-length check is a configurable heuristic, not semantic analysis. Audit all pages and the intended product set before treating a report as catalog-wide.

This is an independently authored public project using synthetic examples. It does not contain employer code or data. Shopify is a trademark of Shopify Inc.; this project is not affiliated with or endorsed by Shopify.

Built by [Nauman Masood](https://nsdmalik.dev), Senior Software Engineer working across Shopify development, business applications, AI, and data platforms.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Licensed under [MIT](LICENSE).

# Rules and scoring

Ruleset 1.0. The score is a transparent local policy, not a standard published by Shopify, GS1, Google, or any AI vendor.

`score = round(100 × passing scored checks / applicable scored checks)`

Each applicable scored check has equal weight. Product checks occur once per product; variant and image checks occur once per supplied variant/image. Large products contribute more checks to the catalog score. The report exposes the numerator and denominator at both product and catalog level. Error and warning are both nonpassing for scoring, but separate severities for CI gates.

| Rule | Failure level | Policy |
| --- | --- | --- |
| title.present | warning | Nonblank title |
| description.depth | warning | At least 40 words by default; configurable |
| brand.present | warning | Nonblank vendor |
| type.present | warning | Nonblank productType; category taxonomy is not evaluated |
| images.present | warning | At least one supplied product image |
| image.url | error | Absolute HTTP(S) URL; no remote fetch |
| image.alt | warning | Nonblank alternative text |
| variants.present | warning | At least one supplied variant |
| price.valid | error | Nonnegative decimal price; zero accepted |
| sku.present | warning | Nonblank SKU |
| sku.unique | warning | Exact case-sensitive SKU uniqueness after trimming; only checked for nonblank SKUs |
| gtin.checksum | error | If supplied, 8, 12, 13, or 14 digits with a valid check digit; all-zero codes rejected |
| gtin.required | warning | Missing GTIN when product.gtinRequired is true |
| gtin.optional | skipped | Missing GTIN when product.gtinRequired is false |
| seo.title / seo.description | informational | Explicit overrides noted, absent overrides skipped; never scored |

Whitespace-only strings are absent. The description heuristic strips tags, scripts, styles, comments, and encoded entities, then counts Unicode letter/number sequences. Hyphenated and apostrophe-containing words remain single words. It is not a browser renderer or an assessment of whether the text accurately describes a product; thresholds need adjustment for language and catalog context.

GTIN checks use the [GS1 check-digit calculation](https://www.gs1.org/services/how-calculate-check-digit-manually). Passing does not validate registration, allocation, licensing, or ownership. A failing code should be checked against its authoritative source, never replaced with an invented one.

Missing SKUs, brands, types, and optional product information are policy warnings, not claims that Shopify rejects those products. Duplicated SKUs can be intentional, so the remedy is investigation before editing.

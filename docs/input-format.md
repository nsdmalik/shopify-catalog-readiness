# Input format

The CLI accepts a UTF-8 JSON object up to 10 MiB. The library accepts the equivalent in-memory object. Empty catalogs and duplicate product IDs are rejected. IDs are trimmed, nonempty strings. Fields representing identifiers, including barcodes, must remain strings so leading zeros are preserved.

## Normalized snapshot

```json
{
  "products": [
    {
      "id": "demo:product-1",
      "title": "Canvas Tote",
      "descriptionHtml": "<p>Describe the product here.</p>",
      "vendor": "Example Supply",
      "productType": "Tote Bags",
      "images": [{ "url": "https://example.com/tote.jpg", "altText": "Natural canvas tote" }],
      "variants": [{ "sku": "TOTE-NATURAL", "price": "29.00", "barcode": "" }],
      "gtinRequired": false,
      "seo": { "title": "", "description": "" }
    }
  ]
}
```

Only the envelope and unique product ID are structurally required. Omitted catalog fields become audit findings or skipped checks, not a fabricated passing value. Optional text can be null. Prices accept a finite nonnegative number or an unsigned decimal string. Zero-priced products are valid. Currency symbols and exponent notation in price strings are rejected.

`gtinRequired` is this tool's per-product policy field, not a Shopify API field. It defaults to false. When true, every variant is expected to have a GTIN. A nonempty barcode is always validated as a GTIN; if your catalog uses proprietary barcode formats, interpret those findings accordingly.

## Shopify GraphQL response

The adapter accepts `{ "data": { "products": ... } }`, with products and nested variants/media as `nodes` or `edges` connections. It uses `MediaImage.image.url` and `altText` (falling back to the media's `alt`). Videos and models do not substitute for an image. A MediaImage whose image is still null produces an invalid-image finding.

The read-only query in [catalog-query.graphql](catalog-query.graphql) shows the fields to export using your own authorized tooling. It is a **page query**, not a complete export implementation. The repository never asks for a Shopify credential.

- Fetch every product page and every nested variants/media page.
- Preserve `pageInfo.hasNextPage` until all pages are merged. The tool rejects a connection where it is explicitly true.
- After merging all pages, supply the normalized arrays, or connections with `hasNextPage: false`.
- When pageInfo is omitted, completeness cannot be verified. You are responsible for providing a complete intended snapshot.
- GraphQL errors cause the audit to fail even when partial data is present.
- Supply either `images` or `media`, not both. Media nodes must include `__typename`.

This audit evaluates the supplied products, not every publication/channel or all store settings. It does not examine checkout, shipping policies, market availability, robots directives, structured data on a live page, or actual discovery by an AI system.

Reference: [Shopify Product](https://shopify.dev/docs/api/admin-graphql/latest/objects/Product) and [MediaImage](https://shopify.dev/docs/api/admin-graphql/latest/objects/MediaImage).

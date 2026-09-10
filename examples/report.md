# Catalog readiness report

**67/100** snapshot completeness and consistency

Products: 3 · Errors: 2 · Warnings: 9 · Skipped: 7

Ruleset: 1.0. Supplied snapshot only. No storefront crawl, image fetch, AI ranking prediction, or store modification.

This score describes the supplied data under a documented policy. It does not predict AI recommendations, search rankings, or sales.

## Findings

| Product | Level | Rule | Field | Finding | Next step |
| --- | --- | --- | --- | --- | --- |
| Ceramic Cup | warning | description.depth | descriptionHtml | 3 description words; configured threshold 40 | Describe the product, material, intended use, and relevant specifications. |
| Ceramic Cup | warning | brand.present | vendor | Brand/vendor is missing | Supply the correct product brand or vendor. |
| Ceramic Cup | warning | image.alt | images\[0\].altText | Image alternative text is missing | Describe the image for people who cannot see it. |
| Ceramic Cup | warning | sku.unique | variants\[0\].sku | SKU is repeated in this snapshot | Confirm whether the shared SKU is intentional before changing it. |
| Ceramic Cup | error | gtin.checksum | variants\[0\].barcode | Barcode is not a valid GTIN format/check digit | Check the product identifier against its authoritative source. Do not invent a barcode. |
| Travel Pouch | warning | description.depth | descriptionHtml | 5 description words; configured threshold 40 | Describe the product, material, intended use, and relevant specifications. |
| Travel Pouch | warning | type.present | productType | Product type is missing | Provide a consistent product type for this catalog. |
| Travel Pouch | warning | images.present | images | No images supplied | Include product images in the snapshot. |
| Travel Pouch | error | price.valid | variants\[0\].price | Price is missing or invalid | Provide a nonnegative decimal price without currency symbols. |
| Travel Pouch | warning | sku.unique | variants\[0\].sku | SKU is repeated in this snapshot | Confirm whether the shared SKU is intentional before changing it. |
| Travel Pouch | warning | gtin.required | variants\[0\].barcode | GTIN required by this snapshot policy but missing | Supply the assigned GTIN or confirm an applicable exemption. |

## Score calculation

22 passing scored checks / 33 applicable checks. Optional SEO overrides and skipped checks do not affect the score.

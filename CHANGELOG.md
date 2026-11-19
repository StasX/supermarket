# Changelog

## 2.0.0

### Upgrade notes

- Move clients to the `/api/auth`, `/api/products`, `/api/carts`, and `/api/orders` routes. Product IDs use `id`, count endpoints return `count`, cart and order timestamps use `createdAt`, and missing carts or orders return `null`. See the [API reference](README.md#api-reference) for request and response details.
- Send uploaded images with the product create or update request as multipart form data. This replaces the standalone upload endpoint. AWS S3 deployments need `s3:DeleteObject` for managed product images.
- Checkout requests must include `reviewedItems` with each product ID, quantity, and unit price in cents. Catalog list, category, and search responses now return bounded pages with a `nextCursor`.
- Provision MongoDB indexes before starting the upgraded app. Docker Compose runs the `db-indexes` service automatically. For a local deployment, build the backend and run `npm --prefix backend run db:indexes` against the app's database. Resolve duplicate names or other conflicting records if a unique index cannot be created.

### Changed

- Added indexed case-insensitive product name search and **Load more** controls to the storefront and product manager.
- Ask customers to review and confirm updated items when cart contents or catalog prices change before checkout. Reject duplicate product IDs in the reviewed items.
- Generate and store invoice PDFs on the first authorized download, so customers can retry a failed download independently of checkout.
- Split the backend API controller into authentication, product, cart, and order controllers. Centralized request validation and tightened MongoDB schemas and update validation.

### Fixed

- Recover interrupted orders from saved checkout snapshots on startup and during periodic background checks. Preserve the original checkout time in order history and reuse the same order on retries.
- Tie uploaded images to product saves. Clean up replaced, deleted, or abandoned uploads and persist failed deletions for retry across restarts. Check current product references before deleting an image.
- Enforce unique product names at the database level, including concurrent saves.

### Security

- Revoke the session JWT server-side on logout until it expires, preventing reuse after logout.
- Replace the email validation pattern to avoid excessive regex backtracking on malformed input.

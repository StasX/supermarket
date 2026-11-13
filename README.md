# Supermarket

Setup instructions and API reference for the Angular frontend, NestJS backend, and MongoDB database.

## Database setup

Create a database named `shop` and import the collections from the [db/seeds](db/seeds/) directory:

- `carts.json`
- `orders.json`
- `products.json`
- `users.json`

## Administrator login

The seeded demo administrator credentials are:

| Field    | Value                 |
| -------- | --------------------- |
| Username | `j.smith@example.com` |
| Password | `sec907@Ad0`          |

## Project structure

```text
backend/
  src/         NestJS controllers, services, guard, module, and MongoDB models
  tests/       Jest HTTP tests using NestJS and mocked MongoDB models
frontend/
  src/         Angular 22 standalone components, services, forms, routes, and unit tests
  e2e/         Playwright browser tests
db/
  Dockerfile   MongoDB image definition
  01-import.sh Database initialization script
  seeds/       Database seed collections
```

Use Node.js 26.13.1 LTS (`.nvmrc`), also pinned in Docker and GitHub Actions. All project manifests require the Node.js 26 line starting at 26.13.1; Node.js 25 is unsupported. Install dependencies with `npm ci --prefix backend` and `npm ci --prefix frontend`, then run `npm start` after setting up MongoDB and a session signing key. Startup builds the Angular application into `frontend/dist/browser` and compiles NestJS into `backend/dist`. NestJS serves the built frontend and API at `http://localhost:3000`, keeping session cookies on the same origin.

The frontend uses Angular 22, TypeScript 6, standalone components, reactive forms, signals, HttpClient, and role-based route guards. AngularJS, UI Router, jQuery, and their old templates have been removed. Hash routing keeps frontend URLs separate from API endpoints; old `#!/` bookmarks are normalized to `#/`. Product listing, category filtering, search, administrator add/edit, signup/login, session reconnect, and saved carts use the existing API. Cart state is restored from MongoDB rather than the old browser localStorage format. Checkout collects city, street, shipping date, and demo credit-card details, then saves the order and closes the cart. Demo checkout does not charge a card.

For frontend development, run the backend on port 3000 and `npm --prefix frontend start` in another terminal. Open `http://localhost:4200`; the Angular development server proxies API calls to NestJS. Change `frontend/proxy.conf.json` if the backend uses a different port. Run `npm run build` from the root to build both projects without starting them.

Bundled catalog photos live in `backend/static/products` and remain public at `/products/<filename>.png`. Administrator uploads (PNG, JPEG, or WebP, up to 5 MB) are saved in the private MinIO `product-images` bucket. `POST /upload-product-image` returns `/products/uploads/<generated-filename>`; the backend streams these images without exposing MinIO credentials or requiring browser access to its API. The bucket is created automatically. Image validation and administrator permissions are unchanged.

Both Compose files build MinIO from the pinned upstream `RELEASE.2025-09-07T16-13-09Z` source using `minio/Dockerfile`, avoiding the unavailable prebuilt image repositories. The first build downloads Go dependencies and compiles the server, so it takes longer; later local builds reuse Docker layers. The MinIO image includes its health check and runs as UID/GID 1000. Existing MinIO data volumes must be writable by this user.

Compose stores MinIO objects in the named `minio_data` volume and no longer mounts product directories into the app. Copy `.env.example` to `.env` and choose your own MinIO credentials. All S3 client settings are defined in `.env`, which Compose loads through `env_file`; AWS credentials reference the MinIO credentials by default. The MinIO console is bound to `127.0.0.1` and available locally at `http://localhost:9001`; its API stays inside the Compose network. The backend uses the official `@aws-sdk/client-s3` package. It accepts `S3_ENDPOINT` (a full URL), `S3_FORCE_PATH_STYLE`, `S3_CREATE_BUCKET`, `S3_BUCKET` (default `product-images`), and `AWS_REGION` (default `us-east-1`). Credentials use the standard AWS provider chain, including `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional `AWS_SESSION_TOKEN`, and IAM roles. Compose supplies the MinIO endpoint, credentials, path-style addressing, and automatic bucket creation. For a backend running outside Docker, configure them to point to an accessible MinIO instance; port 9000 is not published by the default Compose file.

For AWS S3, provision the bucket first, set `S3_BUCKET` and `AWS_REGION`, omit `S3_ENDPOINT`, and leave `S3_FORCE_PATH_STYLE` and `S3_CREATE_BUCKET` unset or `false`. Provide an IAM role or AWS credentials with object read/write permissions. Update these values in `.env` when deploying against AWS; the example defaults target the local MinIO service.

Existing uploaded files are not automatically migrated or deleted. Keep the old `product_uploads` volume and locally uploaded files until migration is verified. Copy legacy files into the MinIO bucket using their generated filename as the object key. Existing `/products/uploads/<filename>` URLs then work unchanged. Older records using `/products/<generated-filename>` must be updated to `/products/uploads/<generated-filename>` after copying their images. Bundled catalog records need no changes. Do not run `docker compose down --volumes` if you need to preserve database, signing-key, or MinIO data.

The backend uses NestJS 12 with its Express HTTP adapter and TypeScript 7. It keeps CommonJS application output with NodeNext module resolution so Node.js can load NestJS 12's ESM packages. Routing belongs to `ApiController`, authentication to `AuthService` and `SessionGuard`, and product/cart/order queries to `ShopService`. `DatabaseModule` connects to MongoDB and injects models. The old Express routers and middleware have been removed. Existing API paths, including `/sign-up` and `/reconect`, and the `SESSIONID` cookie remain supported. Existing JWT sessions remain accepted; new tokens contain the user ID, a returning-login flag, and standard timestamps. Checkout supports demo orders without real payment processing.

## Docker

Start MongoDB and the application from the project root:

```sh
docker compose up --build -d --wait
```

Open `http://localhost:3000`. The multi-stage app image compiles Angular and NestJS, then includes the built frontend and production backend dependencies. MongoDB is available only inside the Compose network. Its image imports the four `db/seeds/*.json` files into `shop` when the database volume is first initialized. Existing database volumes are preserved and are not reimported.

Database data, MinIO objects, and the generated session-signing key are stored in named volumes. Stop the containers while retaining these volumes with `docker compose down`. View logs with `docker compose logs -f`.

The MongoDB image runs as `mongodb:mongodb` (UID/GID 999), including initialization and health checks. New named volumes inherit the image's data-directory ownership; integration tests explicitly give their temporary data directory UID/GID 999. Existing volumes and bind mounts must already be writable by this user because startup no longer runs as root to repair ownership.

The application and integration tests build `db/Dockerfile`, based on MongoDB **9.0.8**, pinned to the latest stable official Docker image verified on November 12, 2026 ([official image tags](https://github.com/docker-library/official-images/blob/master/library/mongo), [release notes](https://www.mongodb.com/docs/manual/release-notes/9.0/)). Both inherit its `mongosh` health check (5-second interval and timeout, 20 retries, 30-second startup period). The backend uses Mongoose 9 with the MongoDB Node.js 7 driver and promise-based queries.

### Existing MongoDB 4.4 data

Compose mounts the named volume `mongodb_data` at `/data/db` (normally `<compose-project>_mongodb_data`). A new, empty volume is initialized with the seed catalog; an existing volume is reused without reimporting seeds. Compose does not create a separate volume for MongoDB 9 or automatically migrate existing data. If this volume contains MongoDB 4.4 data, do not start MongoDB 9 against it. Keep the original volume until migration and verification are complete.

To preserve an existing database, stop application writes, back up the 4.4 deployment, and test the supported staged upgrade on a copy of its data: **4.4 -> 5.0 -> 6.0 -> 7.0 -> 8.0 -> 9.0**. At each stage, follow that release's standalone upgrade procedure, verify the database, and set the required feature compatibility version before continuing. MongoDB documents the [9.0 upgrade prerequisites and procedure](https://www.mongodb.com/docs/manual/release-notes/9.0-upgrade-standalone/), including the requirement to reach 8.0 or 8.3 first. Transfer the validated upgraded data into the new deployment only after backup and testing; changing the image tag alone does not migrate the old volume. These repository changes do not run a live data migration.

The backend accepts `MONGODB_URI` (defaults to `mongodb://localhost:27017/shop`), `PORT` (defaults to `3000`), and `JWT_KEY_PATH` (defaults to `backend/src/key.pem` when run directly). Compose sets these automatically and creates the signing key on first startup. For local startup, create a key once with `node -e "require('node:fs').writeFileSync('backend/src/key.pem', require('node:crypto').randomBytes(64).toString('hex'), {flag:'wx', mode:0o600})"`.

Copy `.env.example` to `.env` in the repository root before starting Compose. Compose reads `PORT`, `MONGODB_URI`, `JWT_KEY_PATH`, and `MONGO_INITDB_DATABASE` using `${VARIABLE}` interpolation. The example values are configured for Docker; `PORT` controls both the published port and the application listener. Keep the database name as `shop` to match the seed import script.

For local `npm start`, change `MONGODB_URI` to `mongodb://localhost:27017/shop` and `JWT_KEY_PATH` to the path of an existing local signing key (for example, `backend/src/key.pem`). The backend also loads the root `.env` automatically, regardless of the working directory, using the configured Node.js 26 runtime. Existing environment variables take precedence; a missing `.env` is allowed. `.env` is ignored by Git and excluded from Docker images.

## Formatting

Install the root development tools with `npm ci`, then run `npm run format` to format the project's TypeScript, Angular templates, SCSS, HTML, JSON, YAML, and Markdown files. Run `npm run format:check` to check formatting without changing files. Shared rules live in `.prettierrc.json` and `.editorconfig`.

Generated files, dependency lockfiles, credentials, image assets, and MongoDB's newline-delimited seed collections are excluded from automatic formatting.

## Tests

Tests require Node.js 26.13.1 or newer within the 26.x line. All application code, backend models, startup scripts, and tests use TypeScript. Backend source compiles into `backend/dist`; backend tests compile separately into `backend/tests-dist`, and Jest loads its compiled configuration from `backend/dist/jest.config.js`. The backend test command enables Node's VM module support for NestJS 12 dependencies. Frontend tests use Vitest 5 and jsdom 31. Angular packages are aligned at 22.2.6; frontend TypeScript stays at 6.0.3 because Angular 22 requires TypeScript >=6.0 <6.1 ([compatibility table](https://angular.dev/reference/versions)).

Backend tests compile TypeScript, start a NestJS test application, and exercise HTTP endpoints with Jest and Supertest. Frontend tests use Angular TestBed, HttpTestingController, Vitest, and jsdom. No separately running server or MongoDB database is needed for these suites.

Install both projects' dependencies from the root before the first run:

```sh
npm ci --prefix backend
npm ci --prefix frontend
```

Run both backend and frontend tests from the project root:

```sh
npm test
```

Run either suite separately from the project root:

```sh
npm run test:backend
npm run test:frontend
```

- Backend tests exercise static frontend serving, product listing/search/category queries, validation, counts, signup/password hashing, JWT login/reconnect, expired or malformed tokens, logout, role guards, product management, cart ownership, and order history.
- Frontend tests exercise Angular price/email/password confirmation validators, page titles, navigation permissions, session reconnect, logout success/failure handling, API compatibility, cart persistence/totals, and rendered login/signup forms. These replace the old AngularJS directive tests; they are not identical tests.

Backend tests exercise real NestJS HTTP routing, guards, cookie handling, and JWT verification with injected MongoDB model doubles. They do not verify MongoDB persistence. Root `npm run test:backend` builds the Angular frontend first so static-serving tests have a production bundle. GitHub Actions installs both projects' dependencies and runs both suites on pushes and pull requests.

Integration tests in `backend/tests/integration.test.ts` exercise the real API and MongoDB persistence for signup/login, permissions, products, carts, and logout. With Docker running, use these commands from the project root:

```sh
docker compose -p supermarket-integration -f integration.compose.yml up --build --abort-on-container-exit --exit-code-from tests
docker compose -p supermarket-integration -f integration.compose.yml down --volumes
```

The suite uses isolated MongoDB and MinIO containers with temporary data and a separate signing key. Its S3 settings and disposable credentials live in `integration_tests/.env.integration`, independently of the local `.env`. It also verifies that uploaded images exist in MinIO and are served through the API. GitHub Actions runs it in the integration job on pushes, pull requests, and manual runs, and always cleans up the containers.

With Docker Compose running and Google Chrome installed, run `npm --prefix frontend run test:e2e` for Playwright browser tests. Customer signup/cart operations use mocked API responses to avoid changing database records. The administrator smoke test uses the documented demo login against the running backend and reads products without editing them. Override `E2E_BASE_URL` if the app is not on port 3000. For Playwright's bundled browser, install Chromium with `npx --prefix frontend playwright install chromium` and set `PLAYWRIGHT_CHANNEL=chromium`. Browser tests are separate from the default CI unit/HTTP suites.

## API reference

API paths are relative to the backend origin (`http://localhost:3000` by default). Only `/login` and `/sign-up` are public API endpoints. All other API endpoints require the `SESSIONID` cookie set by login. Role `0` is a customer; role `1` is an administrator. Missing, invalid, or expired sessions and rejected login credentials return HTTP 401 with `{ "success": false }`. Authenticated users with the wrong role receive HTTP 403 with the same body. Application-level validation failures also generally return HTTP 200; upload errors use HTTP error statuses.

### Products

| Method | Path                        | Description               |
| ------ | --------------------------- | ------------------------- |
| POST   | `/add-product`              | Create a product.         |
| POST   | `/edit-product`             | Edit a product.           |
| POST   | `/upload-product-image`     | Upload a product image.   |
| POST   | `/find-product`             | Find products by name.    |
| GET    | `/get-all-products`         | Get all products.         |
| POST   | `/get-products-by-category` | Get products by category. |

#### Create or edit a product

`POST /add-product` and `POST /edit-product` require an administrator session. Both accept:

```json
{
  "name": "apple juice",
  "category": "Wine & Drinks",
  "price": "10.00",
  "image": "..."
}
```

Response:

```json
{
  "success": true
}
```

For `/edit-product`, include an additional `id` field containing the product's MongoDB ObjectId. Prices must have exactly two decimal places, and category must be one of `Milk & Eggs`, `Vegetables & Fruits`, `Meet & Fish`, or `Wine & Drinks`.

`POST /upload-product-image` also requires an administrator session. Send multipart form data with an `image` file (PNG, JPEG, or WebP, up to 5 MB). Success returns `{ "success": true, "image": "/products/uploads/<generated-filename>" }`. Use that URL as the product's `image` field.

#### Find a product

`POST /find-product`

Request:

```json
{
  "name": "apple juice"
}
```

The request also accepts `product` instead of `name`. Search is case-insensitive and treats the input as literal text.

Response:

```json
{
  "success": true,
  "products": [
    {
      "name": "apple juice",
      "category": "Wine & Drinks",
      "price": 10,
      "image": "...",
      "_id": "..."
    }
  ]
}
```

#### Get all products

`GET /get-all-products`

No request parameters are needed. The response has the same `success` and `products` structure shown for `/find-product`, but each product uses `id` instead of `_id` and includes only `id`, `name`, `category`, `price`, and `image`.

#### Get products by category

`POST /get-products-by-category`

Request:

```json
{
  "category": "Wine & Drinks"
}
```

The response has the same `success` and `products` structure shown for `/find-product`, with matching products in the array.

### Users and sessions

| Method | Path        | Description                |
| ------ | ----------- | -------------------------- |
| POST   | `/login`    | Log in.                    |
| GET    | `/logout`   | Log out.                   |
| GET    | `/reconect` | Reconnect a user session.  |
| POST   | `/sign-up`  | Create a customer account. |

#### Log in

`POST /login`

Request:

```json
{
  "username": "j.smith@example.com",
  "password": "P@ssw0rd"
}
```

Response:

```json
{
  "success": true,
  "role": 1,
  "name": "John Smith",
  "user": "..."
}
```

The response's `user` field contains the user's `_id`. Successful login sets an HTTP-only `SESSIONID` cookie with a JWT valid for nine hours. The cookie includes `Secure` when `NODE_ENV=production` (including the Docker image), so deployed environments must serve the application over HTTPS. Local development without production mode supports HTTP. Invalid credentials return `{ "success": false }`.

#### Log out

`GET /logout`

No request parameters are documented.

Response:

```json
{
  "success": true
}
```

#### Reconnect

`GET /reconect`

No request parameters are needed. The response includes `success`, `role`, and `user` as in `/login`, but `name` is an object containing `first_name` and `last_name`.

#### Sign up

`POST /sign-up`

Request:

```json
{
  "id": "123456789",
  "firstName": "John",
  "lastName": "Bryce",
  "email": "jbt@example.com",
  "pass": "123456789",
  "city": "Tel Aviv",
  "street": "Ha Masger"
}
```

Response:

```json
{
  "created": true
}
```

The ID must contain nine digits and the password must contain at least eight characters. New accounts always receive customer role `0`. Failed signup returns `{ "created": false, "reason": "..." }`.

### Statistics

| Method | Path              | Description                 |
| ------ | ----------------- | --------------------------- |
| GET    | `/total-orders`   | Get the number of orders.   |
| GET    | `/total-products` | Get the number of products. |

Both endpoints require a customer session and take no request parameters.

`GET /total-orders` response:

```json
{
  "success": true,
  "ordersCount": 1
}
```

`GET /total-products` response:

```json
{
  "success": true,
  "productsCount": 1
}
```

### Carts and order history

All of these endpoints require a customer session and operate on that customer's records.

| Method | Path              | Request                                                         | Description                                         |
| ------ | ----------------- | --------------------------------------------------------------- | --------------------------------------------------- |
| POST   | `/create-cart`    | `{ "products": [{ "id": "<product-object-id>", "count": 1 }] }` | Create an open cart; rejects an existing open cart. |
| POST   | `/update-cart`    | `{ "id": "<cart-object-id>", "products": [] }`                  | Replace the contents of the customer's open cart.   |
| GET    | `/get-cart`       | None                                                            | Return the open cart, if present.                   |
| GET    | `/get-last-order` | None                                                            | Return the most recent order, if present.           |

Cart item IDs must identify existing products, quantities must be positive safe integers, and duplicate product IDs are rejected. Prices are taken from the database; client-supplied prices are ignored. An empty product array is allowed.

A unique partial MongoDB index on `user_id` for carts with `status: 1` enforces one open cart per customer, including concurrent requests. Closed carts are unaffected. Startup waits for this index to be created; if existing data contains multiple open carts for a user, startup fails until those records are reviewed and the extra carts are closed or otherwise resolved. No existing carts are automatically changed or deleted.

The customer welcome page shows the open cart (including an empty open cart), its contents, total, and creation date labeled **Created at**. Without an open cart, it shows the latest order when available and a **Start shopping** button. The welcome heading uses login history: signup marks a new account as not yet logged in, and the first successful login atomically marks it as logged in. Later logins show **Welcome back to Dragon shop** even without prior orders. The signed session retains its greeting across page reloads. Existing accounts and legacy sessions are treated as returning customers.

Successful creation returns `success`, cart `id`, `date`, and normalized `products`; updating returns `success` and normalized `products`. Retrieval returns `{ "success": true, "cart": { "id": "...", "products": [], "created": "..." } }`, or `{ "success": true }` when no open cart exists. Order history returns `{ "success": true, "order": { ... } }`, omitting `order` when none exists. Customer-only `POST /checkout` places demo orders as described below.

## Authentication rate limits

Login allows 20 requests and signup allows 5 requests per connection peer IP address per 15-minute window, with independent limits for each endpoint. All attempts count, including successful and invalid requests. Excess requests return HTTP 429 with `{ "success": false, "reason": "Too many attempts. Please try again later." }` and a `Retry-After` header in seconds. Limits are held in memory per application process and reset on restart; replicas do not share counters. Forwarding headers are ignored to prevent spoofing, so clients behind a reverse proxy share its peer-address limit. Multi-instance deployments should enforce shared limits at the ingress or use a shared limiter store.

## Demo checkout

Checkout at `/#/order/payment` requires a nonempty customer cart. Enter city, street, today or a future shipping date, cardholder name, any 16-digit card number (spaces are allowed), a valid future expiry (`MM/YY`), and any three-digit security code. No charge is made. The browser sends only the card number's last four digits; the full number, expiry, cardholder name, and security code are never sent to the backend or stored in the database.

`POST /checkout` requires a customer session and accepts:

```json
{
  "cartId": "<cart-object-id>",
  "shipping": { "city": "Tel Aviv", "street": "Ha Masger 10", "date": "2099-12-01" },
  "payment": { "method": "credit_card", "last4": "4242" }
}
```

Shipping dates are checked against the shop date in `Asia/Jerusalem`. The backend validates cart ownership and recalculates prices from the catalog, ignoring client totals. Success returns `{ "success": true, "order": { "id": "...", "total": 10.50, "shipping": { "city": "...", "street": "...", "date": "..." }, "payment": { "mode": "demo", "method": "credit_card", "last4": "4242" } } }`. Validation failures return `{ "success": false, "reason": "..." }`.

Checkout closes the cart and saves an immutable order snapshot in one atomic cart update. An order is then inserted with a unique partial index for demo orders by cart ID. Concurrent requests and retries reuse this snapshot and return the same order, including recovery after an interrupted order insert; an intervening cart edit prevents stale checkout. Only demo payment metadata is stored. Existing order records are retained. Real payments require a provider integration before this feature can charge cards.

After saving the order, the backend generates its PDF invoice in the same green table style as the order review. Product names, quantities, and prices are captured in the checkout snapshot, so later catalog edits do not change the invoice. The PDF is stored privately in the configured S3/MinIO bucket (`S3_BUCKET`, default `product-images`) at `invoices/<order-id>.pdf`; MongoDB stores its key in the order's `invoiceKey` field. The existing MinIO data volume preserves invoice files. AWS deployments need read/write permission for this prefix as well as product images.

Checkout returns `order.invoiceUrl`, pointing to `GET /orders/<order-id>/invoice`. The success page's **here** link downloads this saved PDF. The endpoint requires the owning customer's session and sends an `application/pdf` attachment with private, non-cacheable headers. Invoice objects cannot be fetched through the public product-image route. Conditional S3 creation preserves the original PDF during concurrent requests and retries. If invoice storage fails after the order is saved, retrying checkout reuses that order and completes invoice storage. Existing demo orders without an invoice generate and store one on their first authorized download; products from before name snapshots were added display as `Unavailable product`.

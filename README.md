# Supermarket

Database setup and API reference consolidated from [ReadMe.txt](ReadMe.txt) and [api.doc](api.doc).

## Database setup

Create a database named `shop` and import the collections from the [db/seeds](db/seeds/) directory:

- `carts.json`
- `orders.json`
- `products.json`
- `users.json`

## Administrator login

The administrator credentials provided in `ReadMe.txt` are:

| Field | Value |
| --- | --- |
| Username | `j.smith@example.com` |
| Password | `sec907@Ad0` |

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

Use Node.js 22.22.3 (`.nvmrc`), also pinned in Docker and GitHub Actions. Angular 22 also supports Node.js 24.15+ or 26+, but Node.js 25 is unsupported. Install dependencies with `npm ci --prefix backend` and `npm ci --prefix frontend`, then run `npm start` after setting up MongoDB and a session signing key. Startup builds the Angular application into `frontend/dist/browser` and compiles NestJS into `backend/dist`. NestJS serves the built frontend and API at `http://localhost:3000`, keeping session cookies on the same origin.

The frontend uses Angular 22, TypeScript 6, standalone components, reactive forms, signals, HttpClient, and role-based route guards. AngularJS, UI Router, jQuery, and their old templates have been removed. Hash routing keeps frontend URLs separate from API endpoints; old `#!/` bookmarks are normalized to `#/`. Product listing, category filtering, search, administrator add/edit, signup/login, session reconnect, and saved carts use the existing API. Cart state is restored from MongoDB rather than the old browser localStorage format. Checkout displays its unavailable state; no payment or order placement has been added.

For frontend development, run the backend on port 3000 and `npm --prefix frontend start` in another terminal. Open `http://localhost:4200`; the Angular development server proxies API calls to NestJS. Change `frontend/proxy.conf.json` if the backend uses a different port. Run `npm run build` from the root to build both projects without starting them.

Product photos live in `backend/static/products` and are served publicly at `/products/<filename>.png`, including in Docker and through the frontend development proxy. The seed catalog uses these local URLs. Existing database volumes retain their product records. In Product manager, administrators select a PNG, JPEG, or WebP file (up to 5 MB) and see a preview before saving. Editing keeps the current image unless a replacement is selected. The administrator-only multipart endpoint `POST /upload-product-image` accepts the `image` field, checks file signatures, and returns the saved image URL. New uploads use unique filenames directly in `backend/static/products`, served at `/products/<filename>`. Compose bind-mounts this directory so uploaded files appear in the project and persist across rebuilds. The directory must be writable by the container user (`node`, UID 1000) on Linux hosts. The existing `product_uploads` volume remains mounted at the legacy `uploads` subdirectory so older `/products/uploads/` URLs continue to work. The legacy product named `Ce` is depicted as ricotta, matching its original image.

The backend uses NestJS 11 with its Express HTTP adapter. Routing belongs to `ApiController`, authentication to `AuthService` and `SessionGuard`, and product/cart/order queries to `ShopService`. `DatabaseModule` connects to MongoDB and injects models. The old Express routers and middleware have been removed. Existing API paths, including `/sign-up` and `/reconect`, and the `SESSIONID` cookie remain supported. Existing JWT sessions remain accepted; new tokens contain only the user ID and standard timestamps. Checkout is still unfinished.

## Docker

Start MongoDB and the application from the project root:

```sh
docker compose up --build -d --wait
```

Open `http://localhost:3000`. The multi-stage app image compiles Angular and NestJS, then includes the built frontend and production backend dependencies. MongoDB is available only inside the Compose network. Its image imports the four `db/seeds/*.json` files into `shop` when the database volume is first initialized. Existing database volumes are preserved and are not reimported.

Database data and the generated session-signing key are stored in named volumes. Stop the containers while retaining these volumes with `docker compose down`. View logs with `docker compose logs -f`.

This local setup retains MongoDB 4.4.29 and existing data volumes. The backend now uses Mongoose 8 with promise-based queries. MongoDB 4.4 is an end-of-life release; upgrading the database remains separate work and requires planning for existing data volumes.

The backend accepts `MONGODB_URI` (defaults to `mongodb://localhost:27017/shop`), `PORT` (defaults to `3000`), and `JWT_KEY_PATH` (defaults to `backend/src/key.pem` when run directly). Compose sets these automatically and creates the signing key on first startup. For local startup, create a key once with `node -e "require('node:fs').writeFileSync('backend/src/key.pem', require('node:crypto').randomBytes(64).toString('hex'), {flag:'wx', mode:0o600})"`.

Copy `.env.example` to `.env` in the repository root before starting Compose. Compose reads `PORT`, `MONGODB_URI`, `JWT_KEY_PATH`, and `MONGO_INITDB_DATABASE` using `${VARIABLE}` interpolation. The example values are configured for Docker; `PORT` controls both the published port and the application listener. Keep the database name as `shop` to match the seed import script.

For local `npm start`, change `MONGODB_URI` to `mongodb://localhost:27017/shop` and `JWT_KEY_PATH` to the path of an existing local signing key (for example, `backend/src/key.pem`). The backend also loads the root `.env` automatically, regardless of the working directory, using Node.js 22 or newer. Existing environment variables take precedence; a missing `.env` is allowed. `.env` is ignored by Git and excluded from Docker images.

## Tests

Tests require Node.js 22.22.3 or another Angular-supported version. All application code, backend models, startup scripts, and tests use TypeScript. Backend source compiles into `backend/dist`; backend tests compile separately into `backend/tests-dist`, and Jest loads its compiled configuration from `backend/dist/jest.config.js`.

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
docker compose -p supermarket-integration -f compose.integration.yml up --build --abort-on-container-exit --exit-code-from tests
docker compose -p supermarket-integration -f compose.integration.yml down --volumes
```

The suite uses an isolated MongoDB container with temporary data and a separate signing key. GitHub Actions runs it in the integration job on pushes, pull requests, and manual runs, and always cleans up the containers.

With Docker Compose running and Google Chrome installed, run `npm --prefix frontend run test:e2e` for Playwright browser tests. Customer signup/cart operations use mocked API responses to avoid changing database records. The administrator smoke test uses the documented demo login against the running backend and reads products without editing them. Override `E2E_BASE_URL` if the app is not on port 3000. For Playwright's bundled browser, install Chromium with `npx --prefix frontend playwright install chromium` and set `PLAYWRIGHT_CHANNEL=chromium`. Browser tests are separate from the default CI unit/HTTP suites.

## API reference

The following endpoints and examples reproduce the API documented in `api.doc`, with formatting corrected for valid JSON. Paths and field names retain their original spelling, including `/reconect` and signup field `Id`. The source does not specify a base URL, status codes, error responses, or authentication requirements.

### Products

| Method | Path | Description |
| --- | --- | --- |
| POST | `/add-product` | Create a product. |
| POST | `/edit-product` | Edit a product. |
| POST | `/find-product` | Find products by name. |
| GET | `/get-all-products` | Get all products. |
| POST | `/get-products-by-category` | Get products by category. |

#### Create or edit a product

`POST /add-product` and `POST /edit-product` use the same documented request example:

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

The source does not specify how `/edit-product` identifies the product to update.

#### Find a product

`POST /find-product`

Request:

```json
{
  "name": "apple juice"
}
```

Response:

```json
{
  "success": true,
  "products": [
    {
      "name": "apple juice",
      "category": "Wine & Drinks",
      "price": "10.00",
      "image": "...",
      "_id": "..."
    }
  ]
}
```

#### Get all products

`GET /get-all-products`

No request parameters are documented. The response has the same `success` and `products` structure shown for `/find-product`, with all products in the array.

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

| Method | Path | Description |
| --- | --- | --- |
| GET | `/is-new-user` | Check whether the user is new. |
| POST | `/login` | Log in. |
| GET | `/logout` | Log out. |
| GET | `/reconect` | Reconnect a user session. |
| POST | `/signup` | Create a user. |

#### Check whether a user is new

`GET /is-new-user`

No request parameters are documented.

Response:

```json
{
  "success": true,
  "new": true
}
```

#### Log in

`POST /login`

Request:

```json
{
  "user": "User",
  "password": "P@ssw0rd"
}
```

Response:

```json
{
  "role": 1,
  "name": "John Smith",
  "user": "..."
}
```

The response's `user` field contains the user's `_id`.

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

No request parameters are documented. The response has the same `role`, `name`, and `user` structure shown for `/login`.

#### Sign up

`POST /signup`

Request:

```json
{
  "Id": 12345678,
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

### Statistics

| Method | Path | Description |
| --- | --- | --- |
| GET | `/total-orders` | Get the number of orders. |
| GET | `/total-products` | Get the number of products. |

Neither endpoint has documented request parameters.

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

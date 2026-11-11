# Supermarket

Database setup and API reference consolidated from [ReadMe.txt](ReadMe.txt) and [api.doc](api.doc).

## Database setup

Create a database named `shop` and import the collections from the [Collections](Collections/) directory:

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

## Tests

The unit tests require Node.js 22 or newer. Backend tests use Jest; frontend tests use Node's built-in test runner. No running server or MongoDB database is needed.

Install dependencies from `src` before the first run. `--ignore-scripts` skips the legacy native dependency build scripts, which these unit tests do not need:

```sh
cd src
npm install --ignore-scripts
```

Run both backend and frontend tests from the project root:

```sh
cd src
npm test
```

Run either suite separately from `src`:

```sh
npm run test:backend
npm run test:frontend
```

- Backend tests exercise product listing, category queries and validation failures, order/product counts, logout cookie clearing, and route permissions.
- Frontend tests exercise AngularJS price/email/password confirmation validators, page titles, navigation permissions, session reconnect, and logout success/failure handling.

Tests execute the existing application scripts with isolated dependencies. Database calls, Express router registration, and AngularJS registration are replaced with test doubles. These are unit tests; they do not verify live HTTP requests, MongoDB persistence, JWT authentication, AngularJS rendering, or full browser workflows. Application source files are unchanged.

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

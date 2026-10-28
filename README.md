# Nihira Looms

Full-stack India-focused saree store: React storefront, Express API, MongoDB
catalog and order storage, admin dashboard, and Razorpay checkout.

## What is included

- Product catalog with categories, fabric details, image URLs, stock, price in
  INR, and new-arrival filtering.
- Persistent shopping bag in the browser and server-validated guest checkout.
- Inventory is reserved during checkout and released for abandoned orders.
- Razorpay order creation, signature verification, and signed webhook support.
- Admin sign-in, product/stock management, and order fulfillment statuses.
- ₹99 shipping below ₹1,999; free shipping at or above ₹1,999.

## Run with Docker Compose

1. Install Docker Desktop.
2. Copy `.env.example` to `.env`. Set unique, strong, alphanumeric MongoDB
   credentials and a random `JWT_SECRET` of at least 32 characters. Keep `.env`
   private and out of source control.
3. Add Razorpay **test-mode** key ID, key secret, and webhook secret to `.env`.
   Do not put live credentials in source code or commit them.
4. Start the database and application from the project root:

   ```powershell
   docker compose up --build -d
   ```

5. Create the first admin account. Temporarily set `ADMIN_EMAIL` and a unique
   `ADMIN_PASSWORD` of 14–72 bytes in `.env`, then run:

   ```powershell
   docker compose run --rm backend npm run create-admin
   ```

   Remove `ADMIN_PASSWORD` from `.env` after account creation. Sign in at
   `http://localhost:8080/admin`.
6. Open the storefront at `http://localhost:8080` and add real catalog items
   in the admin dashboard. Product image URLs must be public HTTPS links.

The Compose stack keeps MongoDB on the private container network and stores its
data in the `mongo_data` volume. Back up this volume regularly; a container
restart is not a database backup.

To stop the local stack:

```powershell
docker compose down
```

The database volume is retained. To delete it, explicitly run
`docker compose down -v` only when you intend to permanently remove store data.

## Razorpay setup

Use Razorpay test credentials first and complete a test order. Configure a
Razorpay webhook pointing to `https://YOUR_DOMAIN/api/payments/webhook`, using
the same webhook secret as `RAZORPAY_WEBHOOK_SECRET`. Subscribe to
`payment.captured`. Set `APP_ORIGINS` to the exact public storefront origin
(for example `https://nihiralooms.example`) before deployment. Switch to live
Razorpay keys only after test orders, webhook delivery, HTTPS, and order
fulfillment have been verified.

Never expose `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `JWT_SECRET`, or
MongoDB credentials to the browser.

## Local frontend development

The frontend development server proxies `/api` to `http://localhost:5000`.
For local development, set `MONGODB_URI` in `.env` to your local MongoDB
connection string (the example uses `localhost`). Start MongoDB and the API
first, then run:

```powershell
cd backend
npm ci
npm run dev
```

In a second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`). For local development,
set `APP_ORIGINS=http://localhost:5173` in the root `.env`.

## Deployment

The production Docker Compose stack serves the app and API behind Nginx on port
8080. Deploy it on a Docker-capable host with a persistent MongoDB volume,
public HTTPS/domain, private environment variables, backups, and monitoring.
Set `APP_ORIGINS` to the exact production origin. Static-only hosting such as
Cloudflare Pages can host the frontend but cannot run this Node API or MongoDB;
those need a separate service and secure same-site API configuration.

## Production launch checklist

- Replace all example credentials with private random secrets.
- Complete Razorpay test-mode payments, webhook delivery, stock reservation,
  failure, and refund procedures before switching to live payments.
- Configure domain, HTTPS, database backups/restore, monitoring, and access to
  admin credentials.
- Add the store's actual shipping, returns, privacy, terms, customer support,
  and GST/invoice policies. These require business-specific details and are not
  invented by this template.
- Product images should use durable public HTTPS image storage. The admin
  accepts image URLs and does not upload files.
- The store has no automated refund operation, courier/shipping integration,
  GST calculation, customer accounts, or email notifications. Handle those
  operational steps manually and verify payment/refund status in Razorpay.
- A payment captured after its 30-minute stock reservation expires is marked
  `refund_pending` for manual review; do not fulfill it until stock/payment is
  reconciled with the customer.

## Tests

```powershell
cd backend
npm test
```

Build the frontend production bundle with `cd frontend; npm run build`.

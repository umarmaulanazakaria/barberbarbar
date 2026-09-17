# BarberShop Management App — Project 3

Full-stack barbershop management project based on the provided reference UI.

## Features
- JWT authentication, register/login, ADMIN & STAFF authorization
- Customers + blacklist and protected history
- Membership + discount
- Barbers master data
- Services master data
- New Order / check-in with multiple service items
- Snapshot price/duration per order item
- Service workflow: Waiting → In Service → Completed
- Separate payment status: Unpaid / Paid
- Cash, QRIS, Card, Transfer, Other payment methods
- Order history, invoices, service ticket print
- Dashboard and reports
- Responsive React UI with dark navy sidebar and indigo accent based on the reference design

## Stack
Frontend: React + Vite + TypeScript + Tailwind CSS + TanStack Query + Axios + Zod + React Router

Backend: Node.js + Express + TypeScript + Prisma + PostgreSQL + JWT + bcrypt + Zod

## Run the project

### 1. Backend
Open terminal in `server`:

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run seed
npm run dev
```

Backend: `http://localhost:3000`

If `.env` is missing, copy `.env.example` to `.env` and set your PostgreSQL `DATABASE_URL` and `JWT_SECRET`.

### 2. Frontend
Open a second terminal in `client`:

```bash
npm install
npm run dev
```

Frontend: `http://localhost:5173`

Vite proxies `/api` automatically to `http://localhost:3000`.

## Demo accounts after `npm run seed`
- ADMIN: `admin@barber.com` / `admin123`
- STAFF: `staff@barber.com` / `staff123`

Use the ADMIN account when testing Barbers, Services and Membership CRUD.

## Important workflow
1. Create/select Customer
2. Create New Order and choose Barber + Service(s)
3. Waiting → Start Service
4. In Service → Mark as Completed
5. Go to Payment
6. Mark as Paid
7. Paid order appears in Order History and Invoices

## If Prisma types show red after replacing files
Run:

```bash
npx prisma generate
```

Then in VS Code run **TypeScript: Restart TS Server** if necessary.

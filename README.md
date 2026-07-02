# X3 CRM

Hệ thống CRM cho agency digital marketing, xây dựng với Next.js + Laravel + PostgreSQL.

## Tech Stack

- **Frontend**: Next.js 14, Tailwind CSS, Material UI, React Query, Zustand
- **Backend**: Laravel 11, PostgreSQL, JWT Auth
- **Monorepo**: npm workspaces

## Cài Đặt

### 1. Cài dependencies frontend/root

```bash
cd x3-crm
npm install
```

### 2. Cấu hình backend

```bash
cp apps/backend/.env.example apps/backend/.env
```

Backend mặc định dùng PostgreSQL:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=x3crm
DB_USERNAME=x3crm
DB_PASSWORD=x3crm123
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

## Chạy Bằng Docker

Khuyến nghị dùng Docker để backend có sẵn PHP extension `pdo_pgsql`.

```bash
docker compose up -d --build postgres backend
npm run dev:frontend
```

Các service:

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api
- PostgreSQL trong Docker: `postgres:5432`
- PostgreSQL expose ra máy host: `localhost:5433`

Backend container sẽ tự chạy migration và seed khi khởi động.

## Chạy Local

Máy local cần PHP 8.2+, Composer và extension `pdo_pgsql`.

```bash
cd apps/backend
composer install
php artisan migrate --seed
php -S 0.0.0.0:4000 -t public public/index.php
```

Chạy frontend ở terminal khác:

```bash
npm run dev:frontend
```

## Scripts

```bash
npm run dev:backend    # Laravel API: http://localhost:4000
npm run dev:frontend   # Next.js: http://localhost:3000
npm run dev            # Chạy cả frontend và backend local

npm run db:migrate     # php artisan migrate
npm run db:seed        # php artisan db:seed
npm run db:fresh       # php artisan migrate:fresh --seed
```

## Tài Khoản Mặc Định

| Vai trò | Email | Mật khẩu |
|---------|-------|----------|
| Admin | admin@x3crm.com | Admin@123 |
| Leader | leader@x3crm.com | Leader@123 |
| Kế toán | ketoan@x3crm.com | Ketoan@123 |
| Nhân viên | nv002@x3crm.com | Nv002@123 |

## API Hiện Có

- `POST /api/auth/login`
- `GET /api/auth/profile`
- `PUT /api/auth/change-password`
- `GET /api/users`
- `GET /api/users/stats`
- `GET /api/users/{id}`
- `POST /api/users`
- `PUT /api/users/{id}`
- `DELETE /api/users/{id}`

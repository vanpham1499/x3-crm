# X3 CRM

Hệ thống CRM cho agency digital marketing, xây dựng với Next.js + NestJS + PostgreSQL.

## Tech Stack

- **Frontend**: Next.js 14, Tailwind CSS, shadcn/ui, React Query, Zustand
- **Backend**: NestJS, Prisma ORM, PostgreSQL, JWT Auth
- **Monorepo**: npm workspaces

## Cài đặt và chạy

### 1. Chuẩn bị

```bash
# Clone và cài dependencies
cd x3-crm
npm install
```

### 2. Cấu hình database

```bash
# Tạo file .env cho backend
cp apps/backend/.env.example apps/backend/.env
# Sửa DATABASE_URL và JWT_SECRET theo môi trường của bạn
```

### 3. Khởi tạo database

```bash
cd apps/backend
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts
```

### 4. Chạy development

```bash
# Từ root (chạy cả 2 service)
npm run dev

# Hoặc riêng lẻ
npm run dev:backend   # http://localhost:4000
npm run dev:frontend  # http://localhost:3000
```

### 5. Chạy với Docker

```bash
docker-compose up -d
# Sau đó seed dữ liệu
docker exec x3crm-backend npx ts-node prisma/seed.ts
```

## Tài khoản mặc định sau khi seed

| Vai trò | Email | Mật khẩu |
|---------|-------|-----------|
| Admin | admin@x3crm.com | Admin@123 |
| Leader | leader@x3crm.com | Leader@123 |
| Kế toán | ketoan@x3crm.com | Ketoan@123 |
| Nhân viên | nv002@x3crm.com | Nv002@123 |

## API Documentation

Swagger UI: http://localhost:4000/api/docs

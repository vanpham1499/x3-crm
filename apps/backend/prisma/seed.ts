import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = (p: string) => bcrypt.hashSync(p, 10);

  // Users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@x3crm.com' },
    update: {},
    create: {
      code: 'NV000',
      name: 'Admin X3',
      email: 'admin@x3crm.com',
      password: hash('Admin@123'),
      role: UserRole.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: 'leader@x3crm.com' },
    update: {},
    create: {
      code: 'NV001',
      name: 'Nguyễn Đức Hòa',
      email: 'leader@x3crm.com',
      password: hash('Leader@123'),
      role: UserRole.LEADER,
    },
  });

  await prisma.user.upsert({
    where: { email: 'nv002@x3crm.com' },
    update: {},
    create: {
      code: 'NV002',
      name: 'Phạm Ngọc An',
      email: 'nv002@x3crm.com',
      password: hash('Nv002@123'),
      role: UserRole.EMPLOYEE,
    },
  });

  await prisma.user.upsert({
    where: { email: 'nv003@x3crm.com' },
    update: {},
    create: {
      code: 'NV003',
      name: 'Ngô Quang Huỳnh',
      email: 'nv003@x3crm.com',
      password: hash('Nv003@123'),
      role: UserRole.EMPLOYEE,
    },
  });

  await prisma.user.upsert({
    where: { email: 'ketoan@x3crm.com' },
    update: {},
    create: {
      code: 'NV010',
      name: 'Kế Toán',
      email: 'ketoan@x3crm.com',
      password: hash('Ketoan@123'),
      role: UserRole.ACCOUNTANT,
    },
  });

  // Services
  const services = [
    { code: 'DV1.1.1', name: 'Quản lý & Tối ưu Google Ads', category: 'DV1', subcategory: 'DV1.1', invoiceContent: 'Phí dịch vụ quảng cáo Google Ads' },
    { code: 'DV1.1.2', name: 'Phí Khởi Tạo Tài Khoản', category: 'DV1', subcategory: 'DV1.1', invoiceContent: 'Phí khởi tạo tài khoản Google' },
    { code: 'DV1.2.1', name: 'Gói dịch vụ Setup PRO', category: 'DV1', subcategory: 'DV1.2', invoiceContent: 'Phí dịch vụ truyền thông trên nền tảng Google' },
    { code: 'DV1.2.2', name: 'Gói dịch vụ Setup Shopping/Youtube', category: 'DV1', subcategory: 'DV1.2', invoiceContent: 'Phí dịch vụ truyền thông trên nền tảng Google' },
    { code: 'DV1.3.1', name: 'Xác minh Google Map', category: 'DV1', subcategory: 'DV1.3', invoiceContent: 'Phí dịch vụ Google Map' },
    { code: 'DV1.3.2', name: 'Quản lý & Tối ưu Map (Hàng tháng)', category: 'DV1', subcategory: 'DV1.3', invoiceContent: 'Phí dịch vụ Google Map hàng tháng' },
    { code: 'DV2.1.1', name: 'Quản lý & Tối ưu Facebook Ads', category: 'DV2', subcategory: 'DV2.1', invoiceContent: 'Phí dịch vụ quảng cáo Facebook Ads' },
    { code: 'DV2.1.2', name: 'Quản lý & Tối ưu Tiktok Ads', category: 'DV2', subcategory: 'DV2.1', invoiceContent: 'Phí dịch vụ quảng cáo Tiktok Ads' },
    { code: 'DV2.2.1', name: 'Thiết kế Nội dung Quảng cáo', category: 'DV2', subcategory: 'DV2.2', invoiceContent: 'Phí dịch vụ truyền thông Facebook' },
    { code: 'DV3.1.1', name: 'Dịch vụ thiết kế Website trọn gói', category: 'DV3', subcategory: 'DV3.1', invoiceContent: 'Dịch vụ thiết kế Website' },
    { code: 'DV3.1.2', name: 'Dịch vụ thiết kế Landing Page', category: 'DV3', subcategory: 'DV3.1', invoiceContent: 'Dịch vụ thiết kế Website' },
    { code: 'DV3.2.1', name: 'Khắc phục lỗi & Xử lý kỹ thuật', category: 'DV3', subcategory: 'DV3.2', invoiceContent: 'Phí dịch vụ bảo trì Website' },
    { code: 'DV3.3.1', name: 'Viết nội dung chuẩn SEO', category: 'DV3', subcategory: 'DV3.3', invoiceContent: 'Dịch vụ viết nội dung đa nền tảng' },
    { code: 'DV4', name: 'Dịch vụ Khác', category: 'DV4', subcategory: 'DV4', invoiceContent: 'Dịch vụ quảng cáo' },
  ];

  for (const svc of services) {
    await prisma.service.upsert({
      where: { code: svc.code },
      update: {},
      create: svc,
    });
  }

  console.log('✅ Seed completed');
  console.log('  Admin: admin@x3crm.com / Admin@123');
  console.log('  Leader: leader@x3crm.com / Leader@123');
  console.log('  Kế Toán: ketoan@x3crm.com / Ketoan@123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

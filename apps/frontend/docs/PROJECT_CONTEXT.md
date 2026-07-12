# X3Sales CRM Frontend Context

This file is the first place Codex should read before changing the project.

## Project

- Product: X3 CRM, internal CRM for X3Sales.
- Brand reference: https://x3sales.vn/
- Brand notes from the public site: X3Sales positions around "X3 doanh thu", digital marketing
  services, practical growth, and agency credibility.
- Current frontend stack: Next.js 14 App Router, React 18, TypeScript, MUI, Emotion,
  `@mui/material-nextjs`, Tailwind CSS, TanStack Query, Zustand, Axios, React Hook Form, Zod.
  Tailwind CSS is the primary styling system. MUI is kept for form/table primitives, theme tokens,
  input behavior, and icons.
- Tailwind CSS remains enabled through `src/styles/globals.css`, `postcss.config.js`, and
  `tailwind.config.ts`. VS Code Tailwind IntelliSense is recommended/installed for className
  autocomplete; workspace settings include TS/TSX support and common class regexes.

## Folder Rules

- `src/app`: Next.js App Router only. Keep route segments, layouts, pages, loading/error files, and
  route-specific composition here.
- `src/app/(app)`: authenticated application routes.
- `src/app/(auth)`: public auth routes and shared auth layout.
- `src/app/(auth)/login`: login route.
- `src/app/(auth)/forgot-password`: forgot-password route.
- `src/components/shell`: application frame components such as sidebar and top header.
- `src/components/upload`: reusable upload components. `ImageUpload` opens a media-library dialog,
  can choose existing images, or upload a new image through the backend media API.
- `src/features`: future domain modules. Put large CRM domains here when a page grows beyond simple
  composition, for example `features/users`.
- `src/services`: external and backend service clients. API client lives in
  `src/services/api/client.ts`.
- `src/stores`: client state stores. Auth store lives in `src/stores/auth-store.ts`.
- `src/lib`: shared generic helpers only, such as formatters and `cn`.
- `src/lib/customer-utils.ts`: customer list constants, filtering/search helpers, link helpers, and
  Tailwind class helpers for customer pills/statuses.
- `src/config`: static app configuration such as brand/site constants.
- `src/types`: shared TypeScript types. Customer type lives in `src/types/customer.ts`.
- `src/hooks`: shared React hooks.
- `src/assets`: source-imported images, icons, and logos. Use `@assets/...` for IDE autocomplete.
- `src/styles`: global/shared CSS. Root layout imports `@/styles/globals.css`; use `@styles/...` for shared CSS imports.
- `src/theme`: MUI theme configuration. App providers wrap the app with
  `AppRouterCacheProvider`, `ThemeProvider`, and `CssBaseline`.
- `docs`: project notes and implementation context.

## Current Routes

- `/`: redirects to `/login`.
- `/login`: login screen.
- `/forgot-password`: forgot password screen.
- `/dashboard`: KPI and revenue dashboard using temporary JSON data from
  `src/features/dashboard/data/dashboard.json`. UI lives in
  `src/features/dashboard/components/dashboard-overview.tsx` and uses Recharts for the monthly
  revenue bar chart and service revenue donut chart.
- `/profile`: current-user profile screen using `GET /auth/me`. It shows avatar, name, role,
  contact/account details, and keeps tabs for Hồ sơ, Dự án, and Khách hàng so future user-owned
  project/customer data can be added without redesigning the page. It should include the standard
  page title and breadcrumb above the profile cover.
- `/customers`: customer/lead list screen populated from `src/data/customers.json`, extracted from
  `CRM Khách hàng mới - Team Sales (1).xlsx`.
- `/leads`: lead management screen using backend `GET/POST/PUT/DELETE /leads`, plus option APIs
  `GET /users`, `GET /customer-sources`, and `GET /services`. It keeps the customer-style table
  layout but uses `src/features/leads/components/lead-manager.tsx` and typed lead data instead of
  reusing static customer JSON. Filtering uses API params and `keepPreviousData` so only the table
  content shows loading after the first page load.
- `/leads/new` and `/leads/[id]`: full-page create/edit forms using
  `src/features/leads/components/lead-form.tsx`, laid out like the customer form with an 8/4 split:
  left for lead/contact/timing information, right for assignment/source/service classification.
  Lead status/source/industry now use the backend `/options` API groups `lead_status`,
  `lead_source`, and `industry`. The source field is an MUI free-solo autocomplete: users can select
  an existing `lead_source` option or type a new source name. On submit, the page creates the source
  via `POST /options` first, then saves the lead with the returned `sourceOptionId`.
- `/customers/new`: create customer form. Submit currently builds/logs a payload and is ready to
  swap TODO comments for API calls.
- `/customers/[id]`: edit customer form using `leadCode` from the extracted Excel data as the route
  id. Submit currently builds/logs a payload and is ready to swap TODO comments for API calls.
- Customer list UI lives in `src/features/customers/components/customer-list.tsx`. It uses MUI
  checkboxes for row selection. Selecting rows shows a green selected action bar; each row has a
  separate edit icon and a three-dot MUI menu with edit/delete placeholders.
- Customer create/edit form uses a full-width 8/4 layout: left column contains customer information
  including status and dates, right column contains classification and assignment. Inputs, selects,
  multi-select checkboxes, and date fields use MUI components. Date fields use `@mui/x-date-pickers`
  with Day.js; the month field is intentionally not part of the form UI.
- `/users`: employee/user listing.
- `/projects`: project list using backend `GET /projects`.
- `/projects/new` and `/projects/[id]`: full-page create/edit forms using
  `src/features/projects/components/project-form.tsx`, laid out like customer and lead forms.
- `/quotations`: quotation list using backend `GET/DELETE /quotations`.
- `/quotations/new` and `/quotations/[id]`: full-page create/edit quotation forms using backend
  `POST/PUT /quotations`. The form stores quote lines in API `items`, keeps manual rows dynamic, and
  can prepend automatic budget/management/setup rows from service quote config when available.
- `/projects/quotes`: legacy route that redirects to `/quotations`.
- `/projects/partners`: project partner option screen using backend `/options` group
  `project_partner`. Visible fields are Mã đối tác, Tên đối tác, STK, Ngân hàng, and Dịch vụ.
  Mapping: `key` stores partner code, `label` stores partner name, `value` stores service, and
  `meta.accountNo` / `meta.bankName` store bank details.
- `/projects/services`: service management screen using backend `GET/POST/PUT/DELETE /services`.
  It renders services as a tree table, supports keyword/status filters, and uses MUI dialogs for
  create/edit plus shared confirmation dialog for delete. Keep service list logic in
  `src/features/services/components/service-manager.tsx`.
- `/settings/options`: system option management screen using backend `GET/POST/PUT/DELETE /options`.
  It shows domain tabs for Lead, Khách hàng, and Dự án using grouped option cards. UI lives in
  `src/features/options/components/options-manager.tsx`.
- `/settings`: settings overview screen. It stores website/company profile information in backend
  options group `site_profile` with keys `companyName`, `taxCode`, `phone`, `website`, `address`,
  and `office`. Shared defaults and mapping live in `src/lib/site-profile-options.ts`.
- `/settings/bank-accounts`: company receiving bank accounts stored in backend options group
  `company_bank_account`. Mapping: `key` is the VietQR bank code, `label` is account holder name,
  `value` is account number, and `meta` stores `bankName`, `branch`, and `isDefault`.
- `/users/new`: create employee/user.
- `/users/[id]`: employee/user detail and edit form.
- `/users/roles`: role list screen using backend `GET /roles` with `keyword` filter.
- `/users/roles/new`: create role form using `POST /roles`, then optionally
  `POST /roles/{id}/permissions` to sync selected permission IDs.
- `/users/roles/[id]`: edit role form using `GET /roles/{id}`, `PUT /roles/{id}`,
  `DELETE /roles/{id}`, and `POST /roles/{id}/permissions`.
- `/users/permissions`: permission list screen using backend `GET /permissions` with `keyword` and
  `module` filters. Backend currently only exposes permission listing, so create/edit permission UI
  should wait until matching API routes exist.
- User list UI lives in `src/features/users/components/user-list.tsx` and follows the customer list
  pattern: search/filter toolbar, MUI row checkboxes, green selected action bar, edit icon, and a
  three-dot MUI menu with edit/delete placeholders. User filters are MUI fields and call the API
  with query params `keyword`, `role_id`, and `is_active`; do not add local tab filters here. Unlike
  customers, user rows should stay as a flat table with one data field per column, not a grouped
  card inside the name column. User list route keeps API querying only and passes data into the
  feature component. On filter changes, keep previous table data with TanStack Query
  `keepPreviousData` and show loading only inside the table, not as a full page/layout reload.
- User create/edit form UI lives in `src/features/users/components/user-form.tsx`. It follows the
  customer form structure while matching the Minimal user edit layout: left profile/status/action
  card, right two-column MUI form card. Create sends `code`, `password`, `name`, `email`, `phone`,
  `avatar`, and `role`; edit sends `name`, `phone`, `avatar`, `role`, and `isActive`. Code/email are
  read-only on edit because the current backend update request does not accept them.
- Role and permission UI lives in `src/features/access-control/components`. Keep role CRUD and
  permission-list screens there rather than placing table/form logic directly in route pages.

## Auth And API

- Auth token key: `access_token`.
- User localStorage key: `user`.
- API base URL: `NEXT_PUBLIC_API_URL`, fallback `http://127.0.0.1:4000/api`.
- Media/public upload base URL: `NEXT_PUBLIC_MEDIA_URL`, fallback to the current frontend origin in
  the browser. Keep database values relative, for example `/uploads/2026/07/file.jpg`, and use
  `src/lib/media-url.ts` to render them.
- API client: `src/services/api/client.ts`.
- App notifications live in `src/components/feedback/notification-provider.tsx` and are mounted in
  `src/app/providers.tsx`. Use `useAppNotification()` for success/error/warning/info toast messages
  instead of rendering form-level MUI `Alert` for normal mutation feedback. API error message
  extraction helper lives in `src/lib/api-error.ts`.
- Confirmation popups should use `src/components/feedback/confirm-dialog.tsx` instead of
  `window.confirm`, especially for destructive actions such as delete.
- Auth store: `src/stores/auth-store.ts`.
- Login calls `POST /auth/login` through the shared API client. A successful login stores
  `access_token` and optional `user`, then redirects to `/users`.
- Auth state is restored from localStorage in `src/app/providers.tsx`. Authenticated app routes in
  `src/app/(app)` require a token and redirect unauthenticated users to `/login`.
- API 401 responses clear `access_token`/`user` and redirect the browser to `/login`.
- Backend media library API lives at `GET /media` and `POST /media/upload`. The backend stores files
  physically under frontend `public/uploads/YYYY/MM` like WordPress, while metadata stays in the
  backend `attachments` table with `entity_type = media_library`. `MEDIA_PUBLIC_PATH` can override
  the physical upload directory on the backend if deployment paths change. Persist relative paths
  such as `/uploads/...` on user avatars, never full domains, so changing domains does not break
  saved image URLs as long as the frontend `public/uploads` folder is moved with the app.
- `src/components/upload/image-upload.tsx` is the shared WordPress-style image picker. It lists the
  current user's uploaded images by default, supports keyword search, uploads new images to
  `POST /media/upload`, and returns the selected relative URL to forms such as the user avatar form.

## Brand Direction

- Primary color currently uses blue in the UI (`#2563eb` / Tailwind `blue-600`).
- Suggested support colors in config:
  - Primary: `#2563eb`
  - Secondary growth green: `#16a34a`
  - Accent orange: `#f97316`
- Keep CRM screens quiet, operational, and scan-friendly. Prefer dense tables/forms, clear actions,
  and restrained decoration.
- Login UI currently follows the Minimal UI sign-in reference at
  `https://minimals.cc/auth/amplify/sign-in`: 480px left illustration rail, wider right form
  area, X3Sales logo, imported Minimal background/illustration/platform icons, floating-label inputs,
  and dark navy submit button. Left platform icons stay grayscale and reveal color on hover. The demo
  credential alert is intentionally removed.
- Auth layout is shared by login and forgot-password screens.
- Full-page loading/auth transition UI uses `src/components/shell/app-splash-screen.tsx`: a clean
  white viewport with the X3Sales logo and a slim shimmer progress bar. Use it instead of returning
  `null` during auth initialization, auth redirects, and route loading.
- Authenticated in-shell route/data loading uses `src/components/shell/content-loading.tsx`: header
  and sidebar remain visible while the main content area shows a centered dark slim progress bar.
- Error pages use `src/components/feedback/error-state.tsx`. Root 404 lives at
  `src/app/not-found.tsx`, recoverable root errors at `src/app/error.tsx`, authenticated shell
  errors at `src/app/(app)/error.tsx`, and fatal root errors at `src/app/global-error.tsx`.
- Auth MUI text fields force `inputLabel.shrink` because Chrome autofill can otherwise leave labels
  overlapping typed values on the login form.
- Current app shell, auth shell, login/forgot-password pages, dashboard placeholder, and users screens
  use Tailwind `className` for layout and visual styling. Avoid adding `sx`/inline `style` in
  `src/app` and `src/components` unless a MUI component API makes it genuinely unavoidable.
- Logged-in app shell follows the Minimal dashboard reference: 300px expanded sidebar, 88px
  collapsed icon-only sidebar, 72px sticky translucent header, grouped menu items, and active item
  tint.
- Header account area shows a theme toggle and user avatar menu only. If the user has an avatar, the
  header must render the avatar image instead of initials. Header refreshes the current user through
  `GET /auth/me` so updated avatar/profile data is not stuck on the login-time localStorage user.
  Backend auth profile returns the user under `response.user`, not always as the root response body.
  The temporary theme toggle stores `light`/`dark` in `localStorage` under `x3_theme` and toggles the
  `dark` class on `document.documentElement`; later this value can be moved to the user
  profile/database.
- Global app font is `Public Sans Variable` loaded from `@fontsource-variable/public-sans` with the
  same fallback stack used by Minimal UI.

## Known Notes

- Some existing Vietnamese strings display as mojibake in PowerShell output. Be careful when editing
  copy; verify with the source editor or browser before broad text rewrites.
- Radix/shadcn legacy UI primitives were removed after migrating the active app screens to MUI.
- User instruction from 2026-06-30: do not run `npm run build` unless the user explicitly asks for
  build. Use dev server checks instead.
- Auth guard is enabled for authenticated app routes. `/` redirects to `/login`; app routes redirect
  unauthenticated users to `/login`, and API 401 responses clear local auth before redirecting.

## Conversation Snapshot - Read This First

This section summarizes the decisions from the full Codex conversation. If old sections above conflict
with this snapshot, prefer this snapshot because it reflects the latest user preferences.

### Working Rules

- Do not run `npm run build` unless the user explicitly asks to run build.
- Use dev checks and TypeScript checks instead. Preferred TypeScript check: `npm exec tsc -- --noEmit`.
- The user prefers Tailwind CSS for layout and visual styling, with MUI for form/table primitives,
  inputs, selects, checkboxes, dialogs, date pickers, menus, icons, and interaction behavior.
- Money/price inputs should use `src/components/form/money-input.tsx`. It displays Vietnamese
  thousands separators such as `1.000.000` while keeping the controlled value as raw digits for
  calculations and API payloads.
- Avoid `sx`/inline style in route/component layout code unless MUI or dynamic color behavior makes it
  genuinely useful.
- Do not use native `alert` or `confirm`. Use shared toast notifications and MUI/custom confirm dialogs.
- Keep large UI in `src/features/<domain>/components`; keep route pages thin.
- For CRUD create/edit flows, use full-page forms like customers and leads by default. Only implement
  create/edit as a popup/dialog when the user explicitly requests a popup.
- Keep this file updated whenever project structure, API contracts, or product decisions change.

### Stack And Libraries

- Next.js 14 App Router, React 18, TypeScript.
- Tailwind CSS is the main styling system.
- MUI, Emotion, `@mui/material-nextjs`, MUI X Date Pickers, Day.js.
- TanStack Query for server state and mutation cache updates.
- Axios API client in `src/services/api/client.ts`.
- Zustand auth store in `src/stores/auth-store.ts`.
- React Hook Form and Zod for forms.
- `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` are used for drag-and-drop option ordering.
- Font is `Public Sans Variable` from `@fontsource-variable/public-sans` with Minimal UI-style fallback stack.

### Brand And Visual Direction

- Product is X3Sales CRM / X3 CRM.
- Brand reference: `https://x3sales.vn/`.
- Logo source: `src/assets/logos/x3sales-logo.svg`.
- Current primary UI color follows the brand/logo direction: blue `#2563eb` / Tailwind `blue-600`.
- Support colors:
  - Green: `#16a34a`.
  - Orange: `#f97316`.
- UI should feel like an operational CRM: dense, scan-friendly, quiet, and professional.
- Minimal UI is the main visual reference:
  - Login: `https://minimals.cc/auth/amplify/sign-in`.
  - App shell/sidebar/header: `https://minimals.cc/dashboard`.
  - User/customer/job forms and lists for CRUD patterns.

### Auth, API, Media

- API base env: `NEXT_PUBLIC_API_URL`; fallback `http://127.0.0.1:4000/api`.
- Auth token key: `access_token`.
- User localStorage key: `user`.
- Login calls `POST /auth/login`.
- Successful login stores token/user and redirects to `/users`.
- API 401 clears auth and redirects to `/login`.
- Media/public env: `NEXT_PUBLIC_MEDIA_URL`.
- Saved media URLs should remain relative, for example `/uploads/2026/07/file.jpg`.
- Do not save full domains in database for uploaded images.
- Uploaded image files are physically stored in frontend `public/uploads/YYYY/MM`, WordPress-style.
- Backend stores media metadata and returns `file_url`.
- Shared image picker/uploader lives in `src/components/upload/image-upload.tsx`.
- Media API:
  - `GET /media`.
  - `POST /media/upload`.
- Default media behavior: users choose their own uploaded images; later permission logic can broaden access.

### Feedback And Loading

- Toast provider: `src/components/feedback/notification-provider.tsx`.
- Use `useAppNotification()` for mutation success/error/info/warning.
- API error helper: `src/lib/api-error.ts`.
- Confirm dialog: `src/components/feedback/confirm-dialog.tsx`.
- Full page auth/loading: `src/components/shell/app-splash-screen.tsx`.
- In-shell route/data loading: `src/components/shell/content-loading.tsx`.
- For list/filter pages, use two loading modes:
  - First page load can show content loading.
  - Filter/refetch should only show table/content loading, not reload the entire shell/layout.
- Use TanStack Query `keepPreviousData` for filters so existing table content stays while refetching.
- Loading color should follow the X3Sales primary color.

### Layout And Sidebar

- App shell follows Minimal dashboard:
  - Expanded sidebar around 300px.
  - Collapsed sidebar around 88px.
  - Header around 72px.
  - Active item uses subtle primary tint.
- Sidebar collapse button must sit centered on the sidebar edge, high z-index, not clipped or hidden under header.
- Header account area:
  - Show theme toggle.
  - Show avatar/account button with the right logged-in user name.
  - Account menu options: Profile and Đăng xuất.
  - Logout must clear auth and redirect to login.
- Theme toggle currently stores `light`/`dark` in localStorage under `x3_theme` and toggles the `dark` class on `document.documentElement`.
- Sidebar menu should include:
  - Dashboard.
  - Lead.
  - Khách hàng.
  - Dự án.
  - Dự án > Dịch vụ.
  - Dự án > Đối tác.
  - Báo giá.
  - Doanh thu.
  - Thanh toán.
  - Hóa đơn.
  - Báo cáo tuần.
  - Báo cáo.
  - Danh mục.
  - Tài khoản.
  - Cài đặt.
- User administration must be separate from system settings:
  - `/users`: Người dùng.
  - `/users/roles`: Vai trò.
  - `/users/permissions`: Phân quyền.
- Settings submenu:
  - `/settings/options`: Tùy chọn.
- Menu items with children should collapse/expand, not display every child all the time.
- Sidebar child menu items should not render icons. Expanded children use a compact tree style with a
  subtle vertical line, short branch line, rounded neutral gray active background, and relaxed
  spacing. Active parent items use a soft emerald background with a small filled icon block.
- Sidebar parent icons use the softer MUI `TwoTone` icon variants already available in
  `@mui/icons-material`. If the project later needs icons closer to the Minimal UI/Solar reference,
  consider adding Iconify/Solar, but do not add that dependency unless requested.
- Header includes a shared calculator tool button next to the light/dark toggle. Clicking it toggles
  `src/components/shell/calculator-panel.tsx`, rendered as a persistent left column between the main
  sidebar and page content. It is not a popup or click-away overlay, so users can keep interacting
  with the current page while the calculator stays open. Calculator display numbers should be
  formatted with Vietnamese thousands separators such as `20.000.000` for money readability.
- Active states must not overlap: Người dùng, Vai trò, and Phân quyền should not all be active together.

### Current Routes

- `/`: redirects to `/login`.
- `/login`: login screen.
- `/forgot-password`: forgot password.
- `/dashboard`: dashboard overview with 4 KPI cards, monthly revenue bar chart, and service revenue
  donut chart. Data is temporary JSON until the backend dashboard API is requested.
- `/profile`: current-user profile page. Keep the tabbed structure: Hồ sơ has personal/account
  information now; Dự án and Khách hàng are placeholders for later user-related data. Keep the
  standard CRM page label and breadcrumb above the profile card.
- `/customers`: customer list.
- `/customers/new`: create customer.
- `/customers/[id]`: edit customer.
- `/leads`: lead list.
- `/leads/new`: create lead.
- `/leads/[id]`: edit lead.
- `/users`: user/employee list.
- `/users/new`: create user.
- `/users/[id]`: edit user.
- `/users/roles`: role list.
- `/users/roles/new`: create role.
- `/users/roles/[id]`: edit role.
- `/users/permissions`: permission list.
- `/projects`: project list.
- `/projects/new`: create project.
- `/projects/[id]`: edit project.
- `/quotations`: quotation list.
- `/quotations/new`: create quotation.
- `/quotations/[id]`: edit quotation.
- `/projects/quotes`: legacy redirect to `/quotations`.
- `/projects/partners`: partner options.
- `/projects/services`: service management.
- `/settings`: settings overview and website/company profile form.
- `/settings/options`: system option management.

### Login And Auth Pages

- Login is based on Minimal UI sign-in.
- Use X3Sales logo.
- Text is Vietnamese.
- Keep the left rail smaller and right form area wider like the reference.
- Left rail has background, illustration, and platform icons.
- Platform icons are grayscale by default and reveal color on hover.
- Remove demo credential banners such as `Use admin@x3crm.com...`.
- Auth MUI text fields force label shrink to avoid Chrome autofill/input label overlap.

### Customers

- Customer API list component: `src/features/customers/components/customer-manager.tsx`.
- Customer API form component: `src/features/customers/components/customer-api-form.tsx`.
- Legacy static customer components/data still exist but active customer routes now use backend
  `GET/POST/PUT/DELETE /customers`.
- Customer backend filters: `keyword`, `customer_type_option_id`, `source_option_id`,
  `industry_option_id`, `sales_user_id`, and `lead_id`.
- Customer list design decisions:
  - Full width.
  - Hide the free "Thêm khách hàng" create button on `/customers`; customers should be created from
    a lead conversion flow only.
  - Use a flat table, not a boxed/card layout inside cells.
  - Visible columns should be: Mã KH, Tên khách hàng, Loại KH, SĐT, Email, Người đại diện, and
    Người phụ trách.
  - Do not show Lead, Website, Source, Service, Created date, or Note columns in the default
    customer list unless requested later.
  - MUI checkbox for row selection.
  - Selected rows show a green selected action bar like Minimal UI.
  - Each row has an edit icon and a three-dot menu with edit/delete options.
  - Each row also has a create-project action linking to `/projects/new?customerId=<customer id>`.
- Customer filters:
  - No tab filters.
  - Use MUI input/select controls.
  - Sales/user, source, industry, and customer type filters call the backend API.
  - Filtering must keep previous table data and show loading only inside the table.
- Customer create/edit:
  - Full width.
  - 8/4 layout.
  - Left column: customer identity/contact/legal/note information.
  - Right column: customer type option, source option, and sales owner.
  - Inputs/selects/date fields use MUI.
- `/customers/new?leadId=<lead id>` preloads the lead and service tree, prefills customer data
    from lead, and creates the customer through `POST /customers`.
  - `/customers/new` is not a free-create page. It must require a valid `leadId`; if `leadId` is
    missing or the lead cannot be loaded, show an error toast and redirect to `/leads`.
  - Before creating a customer from lead, check `GET /customers?lead_id=<lead id>`. If a customer
    already exists for that lead, show an error toast and redirect back to `/leads/<lead id>`.
- Lead-to-customer conversion should update the source lead with `convertedCustomerId` after the
    customer is created.
- After creating a customer from `/customers/new?leadId=<lead id>`, redirect directly to
  `/projects/new?customerId=<created customer id>` so the user can immediately create a project
  attached to that customer.
  - Customer code is exactly the source lead's `lead_code`. It is submitted as `customerCode` but is
    hidden on the customer form.
  - `leadId` is also hidden on the customer form.
  - Customer name defaults to the lead customer name, for example `K.HYUNDAINGOCAN - C.Mai`.
  - Customer industry is text-only in the form. Do not show the industry option select on customer
    create/edit unless requested later.
  - Customer type uses only the `customer_type` option group select, similar to lead source. Do not
    show a separate free-text customer type field.

### Leads

- Lead list component: `src/features/leads/components/lead-manager.tsx`.
- Lead form component: `src/features/leads/components/lead-form.tsx`.
- Lead list started as a copy of customer list but now should use backend lead APIs.
- Lead list rows include an eye/quick-view action. Clicking it opens a view dialog on top of the
  list without navigating away, preserving filters and table state.
- Lead rows that do not have `convertedCustomerId` should show a create-customer action linking to
  `/customers/new?leadId=<lead id>`. Hide this action for converted leads.
- Lead edit page also shows a create-customer action when the lead does not have an existing
  customer. It checks both `convertedCustomerId` and `GET /customers?lead_id=<lead id>`.
- Lead quick-view should fetch `GET /leads/{id}` when opened because the list endpoint does not load
  the full `timelines` relation. Do not rely only on the row payload for timeline counts.
- Lead quick-view dialog has tabs: Thông tin, Lịch sử chăm sóc, and File đính kèm. The Thông tin tab
  mirrors the requested detail layout: lead fields on the left and a care timeline on the right.
- Lead quick-view header includes two primary actions: `Tạo khách hàng mới` linking to
  `/customers/new?leadId=<lead id>` and `Chỉnh sửa lead` linking to `/leads/<lead id>`.
- Lead note/ghi chú must be visible in the quick-view information tab as its own readable block, not
  hidden as a small inline field.
- Lead timeline reads common backend history fields when present (`timeline`, `histories`,
  `history`, `activities`, `activityLogs`, `logs`, or `audits`). Timeline dots use the entry
  `statusOption.meta.color` when available, or the status snapshot in `contentData.status` mapped
  back to the lead status options. Each timeline item should use the color of the status at that
  moment, not the current lead status for every row. Change logs should render field updates such as
  added user or changed status/source/service.
- Lead create/edit must be full-page forms like customers, not popups.
- Lead form layout:
  - Full width.
  - 8/4 layout.
  - Lead/customer/timing information on the left.
  - Assignment/source/service/classification on the right.
- Lead APIs:
  - Use `/leads` for list/create/update/delete.
  - Filter through API when backend supports it.
  - Delete uses confirm dialog and toast.
- Lead option fields use `/options`:
  - `lead_status` for status.
  - `lead_source` for source.
  - `industry` for industry.
- Lead source field should allow selecting an existing source or typing a new source name.
- If a new source is typed, create it with `POST /options` first, then save the lead with the returned option id.
- Newer backend lead resource may include:
  - `statusOptionId`, `sourceOptionId`, `industryOptionId`.
  - `statusOption`, `sourceOption`, `industryOption`.
- Do not return to old `/customer-sources` for lead source if `/options` is available.

### Users

- User list component: `src/features/users/components/user-list.tsx`.
- User form component: `src/features/users/components/user-form.tsx`.
- User list follows customer list style, but rows stay as a flat table:
  - One data field per column.
  - Do not group employee data into a box inside the employee column.
  - Show avatar beside name.
  - If no avatar, show first letter.
  - Use MUI checkbox.
  - Selected rows show a green selected action bar.
  - Each row has an edit icon and a three-dot menu with edit/delete.
- User filters:
  - No tab filter.
  - Use MUI controls.
  - API params/body: `keyword`, `role_id`, `is_active`.
  - Filtering must not reload the whole layout; only table content refetches.
- User delete must call API and use confirm dialog/toast.
- User create/edit:
  - Should visually match customer form card title/description pattern.
  - Create/edit pages should use the standard CRM page header format: `h1` title first, breadcrumb
    below. Do not use a back-link as the page title. Breadcrumb path is
    `Dashboard / Tài khoản / Người dùng / <current>`.
  - Also follows Minimal user edit layout:
    - Left profile/status/action card.
    - Right two-column MUI form card.
  - Create payload includes `code`, `password`, `name`, `email`, `phone`, `avatar`, `role`.
  - Edit payload includes `name`, `phone`, `avatar`, `role`, `isActive`.
  - Code/email are read-only on edit if backend update request does not accept them.
  - Avatar uses shared media picker/upload.
  - When editing the currently logged-in user, update the auth store/localStorage with the mutation
    response so the header avatar/name refreshes immediately after save.

### Roles And Permissions

- Components live in `src/features/access-control/components`.
- Role create/edit pages should use the standard CRM page header format. Breadcrumb path is
  `Dashboard / Tài khoản / Vai trò / <current>`.
- Role routes:
  - `/users/roles`.
  - `/users/roles/new`.
  - `/users/roles/[id]`.
- Permission route:
  - `/users/permissions`.
- Role API:
  - `GET /roles`.
  - `GET /roles/{id}`.
  - `POST /roles`.
  - `PUT /roles/{id}`.
  - `DELETE /roles/{id}`.
  - `POST /roles/{id}/permissions` for syncing selected permissions when available.
- Role list should not show id or avatar; show role name as the main field.
- Role delete/update should use the same confirm dialog and toast pattern as users.
- Permission screen should list/filter permissions. Do not invent create/edit permission flows unless backend routes exist.
- Menu labels should be Vietnamese: Vai trò and Phân quyền.

### Projects And Services

- `/projects` is the project CRUD screen using backend `GET/POST/PUT/DELETE /projects`.
- Project list route fetches supporting data from `GET /customers`, `GET /services?tree=true`,
  `GET /users`, and `GET /options?groups=project_status`.
- Project list UI lives in `src/features/projects/components/project-manager.tsx`; project create/edit
  form lives in `src/features/projects/components/project-form.tsx`; types live in `src/types/project.ts`;
  helper/default/payload logic lives in `src/lib/project-utils.ts`.
- Project backend filters used by the frontend: `keyword`, `customer_id`, `service_id`,
  `status_option_id`, `manager_user_id`, and `sales_user_id`.
- Project list should display project code as the primary project column. Do not show a separate
  project-name column because the project name is already included inside the generated project code.
  Customer column should show only the customer name/company name, not customer code.
- Project create/edit uses full-page routes `/projects/new` and `/projects/[id]`, matching customer
  and lead form format. Do not make project create/edit a popup unless the user explicitly asks for a
  popup. Required fields are customer, service, and project name. Optional fields include project code,
  project status option, manager, sales user, Zalo group, plan link, start date, end date, and note.
- The Project create form must not contain or automatically create a Contract. Contract work starts
  only after the Project exists, inside the `Hợp đồng` tab on `/projects/[id]`.
- `/projects/new?customerId=<customer id>` should preselect that customer in the project form; this is
  used by the lead-to-customer-to-project flow.
- In the project form, customer and service fields live in the right `xl:col-span-4` column with
  status/owner fields. Service must use a searchable autocomplete because the service tree can be
  long; search should match service code, name, and tree path.
- `/projects/[id]` has four tabs: `Thông tin dự án`, `Hợp đồng`, `Tài chính`, and `Khách hàng`.
  `src/features/projects/components/project-contract-panel.tsx` manages multiple contracts through
  backend `/contracts?project_id=<id>` and contract CRUD routes.
- Contract invoice recipient defaults to a legal snapshot of the Project Customer. Each Contract has
  a `Xuất cho chủ thể khác` action that switches to independent recipient fields: name,
  representative, tax code, address, invoice email, and phone. Backend stores these in
  `invoice_recipient_*` columns so later Customer edits do not rewrite contract history.
- Project code is read-only in the form and auto-generated as
  `<customer_code>.<root_service_code>.<project_name>`, for example `001.DV1.M.X3SALES`. The root
  service code is the highest-level parent service code of the selected service, so selecting
  `DV1.1 - Dịch vụ Google / Gói vận hành quảng cáo` uses `DV1`. Force the project code field label
  to shrink because the value is set programmatically. Status options use the `project_status`
  option group, and the list pill uses `statusOption.meta.color` when available.
- Project delete uses the shared confirm dialog and toast notification pattern.
- `/projects/services` manages services via backend `/services`.
- Service quote/pricing configuration is stored in backend `/options`, not in the services table.
  Use option group `service_quote_config`. Only root/top-level services get a quote config; child
  services inherit the config from their root service. Mapping: option `key` is the root service
  code, `value` is the root service id, and `meta` stores `serviceRootId`, `serviceRootCode`,
  `enabled`, `managementFeeRates`, and `setupPackages`. Shared defaults/calculation helpers live in
  `src/lib/service-quote-config.ts`.
- `/projects/services` should show quote configuration only for root services. The config dialog
  edits the management fee rate table for `Đơn kênh` only, plus setup packages. The legacy `multi`
  value may remain in option metadata for backward compatibility, but the current UI should not show
  or use the `Đa kênh` column. Default setup packages are `Gói cơ bản` = 1,000,000 and
  `Gói nâng cao` = 1,500,000.
- `/projects/partners` manages partner records through backend `/options` group `project_partner`.
  Keep this page under the Dự án submenu as `Đối tác`. Partner records are still options, but the
  table/form should expose business fields: `Mã đối tác`, `Tên đối tác`, `STK`, `Ngân hàng`, and
  `Dịch vụ`. Store them as `key`, `label`, `meta.accountNo`, `meta.bankName`, and `value`
  respectively. Helper/default/payload logic lives in `src/lib/project-partner-options.ts`; UI lives
  in `src/features/partners/components/partner-manager.tsx`.
- `/quotations` is the active quotation module and has its own top-level sidebar menu. It uses
  backend `/quotations` for list/create/edit/delete instead of the old frontend-only builder. Quote
  rows must remain dynamic: users can add/remove their own rows with `Nội dung`, `Đơn vị tính`,
  `Số lần`, and `Đơn giá`; do not hard-code rows as the only available structure. The form calculates
  each row as `Số lần * Đơn giá`, sums the subtotal, and applies optional VAT before sending totals
  and `items` to the API. Keep `/projects/quotes` only as a redirect for old links.
- Quotation item payloads currently send both camelCase and snake_case item keys, especially
  `itemName` and `item_name`, because the backend quotation request validates both forms on nested
  `items.*`. Do not remove the duplicate nested item keys unless the backend validator is simplified.
- Quotation is the financial anchor between sales/project/payment. `quotation_code` is the VietQR
  transfer code and should identify a single billing period or quote round, not the long-lived
  project. The backend generates codes as `<project-code-base>.Q001`, `<project-code-base>.Q002`,
  etc. The project code uses the base part without `.Qxxx`; for example project
  `001.DV1.M.X3SALES` can have quotations `001.DV1.M.X3SALES.Q001` and
  `001.DV1.M.X3SALES.Q002`.
- Payment webhook auto-matches only when the transfer content contains an exact `quotation_code`.
  If the quotation already has project/contract, the payment is linked to quotation, lead, customer,
  project, and contract. If project/contract do not exist yet, payment stays linked to quotation and
  lead with `matched_quotation`; once project/contract are created, backend sync updates those
  payments to project/contract via the quotation. Transfers with wrong/manual content should remain
  `unmatched` for accounting to handle manually; do not add fuzzy matching by amount/name/code.
- Local SePay webhook testing uses ngrok. `npm run dev:backend` starts the backend and opens an
  ngrok tunnel to port 4000. The ngrok binary is kept locally under
  `apps/backend/.tools/ngrok/ngrok.exe` and `.tools` is gitignored; `scripts/ensure-ngrok.cmd`
  downloads it if missing. By default the script uses a random ngrok URL because the current ngrok
  account is on the Free plan. `npm run dev:backend:x3sales` sets
  `NGROK_URL=despitefully-ahungered-anh.ngrok-free.dev`, the fixed ngrok dev domain currently
  reserved in the account. SePay webhook URL is
  `https://<ngrok-domain>/api/payments/webhook`.
- `apps/frontend/package.json` also exposes `dev:backend` and `dev:backend:x3sales` as aliases to
  the backend scripts, so running those commands while the terminal is in `apps/frontend` still
  works.
- `apps/backend/scripts/dev-backend.cmd` uses delayed expansion for ngrok variables inside the
  `if not "%START_NGROK%"=="0" (...)` block. Keep `!NGROK_EXE!`/`!NGROK_ARGS!` there; using
  `%NGROK_EXE%` inside that block expands too early and makes the script print `ngrok not found:`.
- Backend Project create/update still accepts a nested `contract` payload for backward compatibility,
  but the current frontend does not send it. Contract CRUD is separate. When a Contract is linked to
  a quotation, backend syncs `contract_id` to the quotation and all payments of that quotation.
- Quote company/website information should come from backend options group `site_profile`. If the
  backend has no saved values yet, use the default profile from `src/lib/site-profile-options.ts`.
- Quote payment QR should use company bank account options from group `company_bank_account`.
  Helper/default/payload logic lives in `src/lib/company-bank-account-options.ts`; management UI
  lives at `/settings/bank-accounts` in
  `src/features/settings/components/company-bank-account-manager.tsx`. The selected receiving
  account is saved in quotation `metadata` with `bankAccountOptionId`, `bankCode`, `bankAccountNo`,
  `bankAccountName`, `bankName`, and `bankBranch`.
- `/settings/bank-accounts` must select the bank from VietQR data instead of manually typing bank
  code/name. Frontend proxy route `/api/vietqr/banks` fetches `https://api.vietqr.io/v2/banks`;
  helper `src/lib/vietqr-banks.ts` loads this list for the dialog. Selecting a bank stores its VietQR
  `code` in option `key` and full bank name in `meta.bankName`.
- VietQR on quotation forms is generated with the selected account, the quotation total, and the
  exact `quotation_code` as transfer content. On create, QR appears after saving because the backend
  generates `quotation_code` and the page redirects to edit.
- Quotation create/edit form target flow:
  - First choose `Khách hàng mới` or `Khách hàng cũ`.
  - New customer flow selects a lead and enters the project name.
  - Existing customer flow then chooses `Dự án mới` or `Dự án cũ`.
  - Existing customer + new project selects a customer and enters the project name.
  - Existing customer + existing project selects a project; customer, lead, service, and project
    name are inferred from that project/customer. The backend quotation schema still requires
    `lead_id`, so customers/projects used here must resolve to a lead.
- Quotation form should keep the VietQR payment block compact at the end of the information column:
  only select the receiving company bank account. Do not show QR preview or warning alerts inside
  the form. QR preview belongs on the `/quotations` list via the row action `Xem QR thanh toán`.
- Quotation form information column should avoid nested bordered boxes. Keep customer/project,
  service pricing, notes, and payment account controls as flat form grids inside the main card.
  Service selector is full width; when auto pricing is enabled, `Ngân sách` and `Gói setup` are two
  half-width fields. Do not show helper copy like "Chọn dịch vụ để kiểm tra bảng giá tự động".
- Quotation manual input rows should also stay flat on a white background. Do not wrap each row in a
  rounded light-gray card; keep only the form controls and spacing needed for scanning.
- Quote service pricing should read backend options group `service_quote_config`. When a selected
  service belongs to a root service with enabled quote config, the quote automatically prepends 3
  calculated rows: `Ngân sách` from user input, `Phí quản lý` from the configured budget rate table,
  and `Phí Setup` from the selected setup package. Manual quote rows remain available below those
  generated rows. The current quote flow uses the `Đơn kênh` rate only; do not show a `Đa kênh`
  selector or column unless the user asks to restore it. The budget/setup inputs should be hidden
  when the selected service/root has no enabled quote config. The service selector should show a
  visible loading state while service and quote-config data are loading.
- Services are tree data.
- Service manager component: `src/features/services/components/service-manager.tsx`.
- Service UI decisions:
  - Use a professional tree/list layout consistent with the site.
  - Data volume is small, so create/edit/delete dialogs are acceptable.
  - Remove the summary section above the list.
  - Put service code before service name.
  - Hide Cấp and Ngày cập nhật columns.
  - Show more database fields if backend returns them.
  - Each parent service should have a distinct color to make groups easy to scan.
  - Support first-load loading and filter/refetch loading.

### Options / Danh Mục Hệ Thống

- Route: `/settings/options`.
- UI component: `src/features/options/components/options-manager.tsx`.
- Types: `src/types/option.ts`.
- Helpers: `src/lib/option-utils.ts`.
- Backend API: `/options`.
- This page is for system-wide configurable options, split by domain tabs so the page does not grow
  too long vertically.
- Option tabs:
  - Lead: `lead_status`, `lead_source`, `lead_service`.
  - Khách hàng: `customer_type`.
  - Dự án: `project_status`, `contract_status`.
- Backend option resource may include:
  - `id`, `group`, `key`, `value`, `label`, `meta`, `sortOrder`, `isActive`, `createdAt`, `updatedAt`.
- Latest UI decision for option create/edit:
  - Only show Tên hiển thị, Màu, and Status/Hoạt động.
  - Remove key and value from the form because id already exists.
  - Remove manual order input from the form.
  - Order should be changed by drag-and-drop inside each group box.
  - Do not drag options across groups unless explicitly requested later.
  - Store color in `meta.color` if backend supports meta.
- Latest data-fetching expectation:
  - Editing/saving/deleting/reordering one group should only update or refetch that group.
  - Avoid refetching every group when only one group changed.
  - Preferred query keys are per group, for example `['options', group]`, or equivalent cache handling.
  - If backend has `/options/reorder`, use it with group + ordered option ids.
  - If backend lacks reorder endpoint, fallback to patching `sortOrder` for items in that group.
- Loading expectation:
  - First load can show content loading.
  - Save/reorder should show loading/overlay only for the affected group box.

### Placeholder Pages

- Several sidebar pages currently do not need real content until requested:
  - Doanh thu.
  - Thanh toán.
  - Hóa đơn.
  - Báo cáo tuần.
  - Báo cáo.
  - Danh mục.
- If the user asks only to update sidebar/menu, do not create full page content.

### Payments / SePay Webhook

- Backend webhook route: `/api/payments/webhook`.
- Public local tunnel currently used for SePay testing:
  `https://despitefully-ahungered-anh.ngrok-free.dev/api/payments/webhook`.
- SePay payload fields are provider-specific and should be normalized before creating `payments`:
  - `content` or `description` -> `transaction_content`.
  - `transferAmount` or `transfer_amount` -> `amount`.
  - `accountNumber` -> `bank_account`.
  - `subAccount` -> `customer_code_text`.
  - `referenceCode` -> `reference`.
- Raw validated webhook data should be preserved in `payments.webhook_payload` for later manual
  reconciliation.
- If the transfer content has no quotation code, create the payment as `unmatched`; this is expected
  for manual transfers or SePay test transactions without a quote code.
- A SePay sample payload with `content = "Giao dich thu nghiem 1h19m34s"` and
  `transferAmount = 1000000` should return HTTP 200 and create an unmatched payment, not HTTP 422.
- SePay requires the webhook response body to contain root-level `{"success": true}`. Do not return
  the normal API resource body from this webhook endpoint; save/match the payment internally, then
  respond with `success: true`.

### Important Files To Check When Resuming

- `docs/PROJECT_CONTEXT.md`: this file.
- `docs/LOGIC_AND_API_NOTES.md`: API and business logic notes.
- `src/components/shell/sidebar.tsx`: sidebar menu, active state, collapsed state.
- `src/components/shell/header.tsx`: header account menu, logout, theme toggle.
- `src/services/api/client.ts`: API client, base URL, auth/401 behavior.
- `src/stores/auth-store.ts`: auth persistence.
- `src/components/feedback/notification-provider.tsx`: global toast.
- `src/components/feedback/confirm-dialog.tsx`: destructive confirm.
- `src/components/upload/image-upload.tsx`: WordPress-style image picker/upload.
- `src/features/options/components/options-manager.tsx`: system options UI and drag ordering.
- `src/app/(app)/settings/options/page.tsx`: options page query/mutation/cache behavior.
- `src/lib/option-utils.ts` and `src/types/option.ts`: option payload/default/grouping behavior.

### Current Latest User Intent

- The user wants the project context to be complete enough that the chat history can be deleted and a future Codex run can simply read this file.
- The most recent feature direction before this context update was the Options page:
  - Form option: only name, color, status.
  - No key/value in UI.
  - Sort order through drag-and-drop inside the group box.
  - Mutations should only refetch/update the affected group.

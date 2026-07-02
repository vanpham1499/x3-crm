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
- `/dashboard`: placeholder dashboard screen with only the "Dashboard" heading.
- `/customers`: customer/lead list screen populated from `src/data/customers.json`, extracted from
  `CRM Khách hàng mới - Team Sales (1).xlsx`.
- `/leads`: temporary lead list screen reusing the customer list/table UI and the same
  `src/data/customers.json` data until a real lead API/data model is wired in.
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
- Header account area shows a theme toggle and user avatar menu only. The temporary theme toggle
  stores `light`/`dark` in `localStorage` under `x3_theme` and toggles the `dark` class on
  `document.documentElement`; later this value can be moved to the user profile/database.
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

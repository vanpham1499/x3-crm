# X3Sales CRM Frontend Context

This file is the first place Codex should read before changing the project.

## Project

- Product: X3 CRM, internal CRM for X3Sales.
- Brand reference: https://x3sales.vn/
- Brand notes from the public site: X3Sales positions around "X3 doanh thu", digital marketing
  services, practical growth, and agency credibility.
- Current frontend stack: Next.js 14 App Router, React 18, TypeScript, MUI, Emotion,
  `@mui/material-nextjs`, Tailwind CSS, TanStack Query, Zustand, Axios, React Hook Form, Zod.
  MUI is the primary UI system.
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
- `src/features`: future domain modules. Put large CRM domains here when a page grows beyond simple
  composition, for example `features/users`.
- `src/services`: external and backend service clients. API client lives in
  `src/services/api/client.ts`.
- `src/stores`: client state stores. Auth store lives in `src/stores/auth-store.ts`.
- `src/lib`: shared generic helpers only, such as formatters and `cn`.
- `src/config`: static app configuration such as brand/site constants.
- `src/types`: shared TypeScript types.
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
- `/users`: employee/user listing.
- `/users/new`: create employee/user.
- `/users/[id]`: employee/user detail and edit form.

## Auth And API

- Auth token key: `access_token`.
- User localStorage key: `user`.
- API base URL: `NEXT_PUBLIC_API_URL`, fallback `http://localhost:4000/api`.
- API client: `src/services/api/client.ts`.
- Auth store: `src/stores/auth-store.ts`.

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
- Current app shell and users screens are migrated to MUI components.
- Global app font is `Public Sans Variable` loaded from `@fontsource-variable/public-sans` with the
  same fallback stack used by Minimal UI.

## Known Notes

- Some existing Vietnamese strings display as mojibake in PowerShell output. Be careful when editing
  copy; verify with the source editor or browser before broad text rewrites.
- Radix/shadcn legacy UI primitives were removed after migrating the active app screens to MUI.
- User instruction from 2026-06-30: do not run `npm run build` unless the user explicitly asks for
  build. Use dev server checks instead.
- Auth guard is temporarily disabled so UI work can continue without login. `/` redirects to
  `/login`, app layout does not push unauthenticated users to `/login`, API 401 responses do not
  redirect, logout no longer redirects, and the sidebar logout button is visual-only for now.

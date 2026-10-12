# MzaziCare Development Log

A running record of every instruction executed during development. Updated after each step.

## Format

Each entry: `#N` · date · instruction (from user) · action taken · files touched.

## Log

| # | Date | Instruction | Action taken | Files touched |
|---|------|-------------|--------------|---------------|
| 1 | 2026-10-12 | Generate an .md file recording every instruction executed during development, and keep it updated | Created this log file; will append an entry after each subsequent instruction | DEVELOPMENT_LOG.md |
| 2 | 2026-10-12 | Read CLAUDE.md project spec; start step by step with a simple, elegant login page (normal system font, consistent colours, stay signed in for 3 months) | Scaffolded Expo (React Native + TypeScript) app in `mobile/` (create-expo-app blank-typescript), installed deps and `expo-secure-store`. Added theme tokens (teal green + warm off-white), login screen (email/password, validation, show/hide password), 90-day session stored in SecureStore and restored on launch, auth API stub (real call to `/api/auth/login/` when `EXPO_PUBLIC_API_URL` is set), placeholder home with sign out. Typechecked with tsc. | mobile/App.tsx, mobile/src/theme.ts, mobile/src/api/auth.ts, mobile/src/auth/session.ts, mobile/src/screens/LoginScreen.tsx, mobile/package.json, mobile/app.json |
| 3 | 2026-10-12 | Create the register page (linked from login); everyone starts as a normal user; RBAC where a user adds caretaker/elderly emails, existing accounts are converted to that role, each role gets its own home screen, and the three are linked through the same parent user | Installed `@react-native-async-storage/async-storage`. Added Role/Profile types, dev-only on-device backend (`mockDb.ts`: register, login, profile, add-member with invites and account conversion), API client that uses Django endpoints when `EXPO_PUBLIC_API_URL` is set, shared UI components, Register screen, "Create one" link on Login, role-based routing in App.tsx with three home screens (UserHome with add caretaker/elderly forms, CaretakerHome, ElderlyHome). Role is re-fetched on every launch so conversions take effect. Removed old `api/auth.ts`. Typechecked and tested the role logic with a scratch script (convert existing, invite then register, duplicate and non-family rejections). | mobile/App.tsx, mobile/src/types.ts, mobile/src/api/client.ts, mobile/src/api/mockDb.ts, mobile/src/auth/session.ts, mobile/src/components/ui.tsx, mobile/src/components/HomeShell.tsx, mobile/src/screens/{LoginScreen,RegisterScreen,UserHome,CaretakerHome,ElderlyHome}.tsx, mobile/package.json |

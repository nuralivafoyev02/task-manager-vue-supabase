# Task Manager — Vue 3 + Supabase + Vercel

Rahbar xodimlarga vazifa biriktiradi, xodimlar esa o‘zlariga tegishli vazifalar statusini yangilab boradi. UI oq-ko‘k minimal uslubda, role-based bo‘limlar bilan ishlaydi.

## Stack

- Vue 3 + Vite + TypeScript
- Supabase Auth + Postgres + RLS
- Vercel Static Build + Serverless Functions
- Telegram Bot API notification

## Ishga tushirish

### 1. Paketlar

```bash
npm install
```

### 2. Supabase migration

Supabase SQL Editor’da ketma-ket run qiling:

```txt
supabase/001_migration.sql
supabase/002_employee_roles_notifications.sql
```

Birinchi rahbar profilini SQL orqali `manager` qiling:

```sql
update public.profiles
set role = 'manager'
where login_email = 'YOUR_MANAGER_EMAIL';
```

### 3. Env

Frontend build uchun:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Vercel Serverless Functions uchun:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET=YOUR_RANDOM_WEBHOOK_SECRET
```

Vercel dashboardida bularni `Project Settings -> Environment Variables` bo‘limiga production, preview va development uchun kiriting.

### 4. Local dev

Frontend:

```bash
npm run dev
```

Vercel functions bilan lokal tekshirish kerak bo‘lsa:

```bash
npx vercel dev
```

### 5. Deploy

Vercel sozlamalari:

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- API functions: rootdagi `api/*.js`
- Environment Variables: yuqoridagi env qiymatlari

## Telegram bot

Bot xodimga yozishi uchun xodim botga avval `/start` yuborishi kerak. Webhook:

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://YOUR_VERCEL_DOMAIN/api/telegram-webhook\",\"secret_token\":\"${TELEGRAM_WEBHOOK_SECRET}\"}"
```

Xodim profilidagi `telegram_username` botdagi username bilan mos bo‘lsa, webhook `telegram_chat_id` ni profilga bog‘laydi. Shundan keyin yangi task yaratilganda xodimga Telegram xabar boradi.

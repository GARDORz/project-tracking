# CLAUDE.md

ไฟล์นี้ให้ข้อมูลแก่ Claude Code (claude.ai/code) สำหรับใช้อ้างอิงเวลาทำงานกับโค้ดในโปรเจกต์นี้

## Stack ที่ใช้

- `frontend/` — Vite + React 19 + TypeScript + Tailwind CSS v4 + React Router v7
- `backend/` — Fastify 5 + TypeScript + Prisma 6.12.0 + PostgreSQL 16, ระบบ auth ด้วย JWT (access + refresh)

Prisma ถูก pin ไว้ที่เวอร์ชัน **6.12.0** — ห้ามอัปเกรดเป็น 7.x (เอา `datasource.url` ออกไปใช้ `prisma.config.ts` แทน) หรือเป็น 6.13–7.10 (มีช่องโหว่ deepmerge-ts, GHSA-ggr8-5vv4-36mx) โดยไม่เช็ค pin นี้ก่อน

## คำสั่งที่ใช้บ่อย

### Dev ในเครื่อง (Postgres รันผ่าน Docker, ทั้งสองแอปรันแบบปกติ)
```
docker compose up -d db                    # รันแค่ Postgres
cd backend && npm install && npm run dev   # Fastify ที่ :3001
cd frontend && npm install && npm run dev  # Vite ที่ :5173 proxy /api ไปที่ :3001
```

### Backend (`backend/`)
- `npm run build` — คอมไพล์ด้วย `tsc` ไปที่ `dist/`
- `npm run lint` / `npm run format` — eslint / prettier
- `npm run test` — รัน unit test ด้วย vitest (`src/**/*.test.ts`, ครอบคลุมเฉพาะ pure function ล้วนๆ เช่น `computeTimeTracking`/`canManageJob` ใน `serviceJobs.ts`, header parsing ใน `projectEquipment.ts` — ไม่ได้ทดสอบ route แบบ integration/DB)
- `npm run prisma:migrate` — `prisma migrate dev`
- `npm run prisma:generate` — สร้าง Prisma client ใหม่หลังแก้ schema
- `npm run prisma:seed` — `tsx prisma/seed.ts`; สร้าง/อัปเดตบัญชี `Admin`/`Admin2559` พร้อมลูกค้า/งานตัวอย่าง รันซ้ำได้ปลอดภัย
- `npm run openapi:generate` — บูตแอปขึ้นมาจริง (ต้องมี Postgres รันอยู่ เพราะ `prismaPlugin` เรียก `$connect()` ตอน `app.ready()`) แล้วดึง OpenAPI spec จาก schema ของ Zod ทุก route มาเขียนที่ `<repo root>/openapi.json` — ดูหัวข้อ "Request validation และ shared types" ด้านล่าง

### Frontend (`frontend/`)
- `npm run build` — `tsc -b && vite build`
- `npm run lint` / `npm run format`
- `npm run test` — รัน unit test ด้วย vitest (`src/lib/**/*.test.ts`, ทดสอบ label/format helper ล้วนๆ)
- `npm run api-types:generate` — รัน `openapi-typescript` แปลง `../openapi.json` (ต้อง `npm run openapi:generate` ที่ backend ก่อน) เป็น `src/lib/api-types.generated.ts`

### CI
`.github/workflows/ci.yml` รันทุก push/PR ไป `main` — สอง job (`backend`, `frontend`) แยกกัน แต่ละ job ทำ `npm ci` → (backend เพิ่ม `prisma generate` โดยใช้ `DATABASE_URL` หลอกเพราะ CI ไม่มี DB จริง) → `lint` → `test` → `build`

### Deploy ทั้งชุดผ่าน Docker Compose
```
cp .env.example .env   # ตั้ง JWT_SECRET / JWT_REFRESH_SECRET (ใช้ openssl rand -hex 48), CORS_ORIGIN
docker compose up -d --build
docker compose exec backend npx tsx prisma/seed.ts   # ทางเลือก: seed บัญชีแอดมิน + ข้อมูลตัวอย่าง
```
ตอน container ของ backend เริ่มทำงาน จะรัน `prisma migrate deploy` ก่อนเปิดเซิร์ฟเวอร์เสมอ ส่วน container ของ frontend เสิร์ฟไฟล์ที่ build จาก Vite ผ่าน nginx (`frontend/nginx.conf`) ซึ่ง proxy คำขอ `/api/*` ไปที่ service `backend` ให้ — เบราว์เซอร์จะเห็นแค่ origin เดียวเสมอ ทำให้ CORS allowlist ของ backend แทบไม่มีผลกับ flow นี้ (จะมีผลก็ต่อเมื่อมี client เรียก backend ตรงๆ เท่านั้น)

## สถาปัตยกรรมของระบบ

### Domain
เป็นระบบติดตามใบงานบริการ (warranty/maintenance/field-service) ไม่ใช่ project tracker ทั่วไป โมเดลหลักอยู่ใน `backend/prisma/schema.prisma`: `User` (role: `ADMIN` / `ENGINEERING` / `SALES`), `Customer` (มีลำดับชั้นแบบอ้างอิงตัวเอง `parentId`), `ServiceJob` (ตัวใบงาน), `ServiceJobAssignee` (ตาราง join — งานหนึ่งงานมีผู้รับผิดชอบได้หลายคน), `JobSequence` (ตัวนับเลข jobNo), `Notification`

### ระบบ Auth และสิทธิ์การเข้าถึง
- ใช้ JWT access token (15 นาที) + refresh token (7 วัน) แยก namespace กันใน `@fastify/jwt` ที่ลงทะเบียนไว้ที่ `backend/src/plugins/jwt.ts` แต่ละ route ถูกป้องกันด้วย preHandler `fastify.authenticate` / `fastify.requireAdmin` ที่ plugin นี้ decorate ให้
- `frontend/src/lib/api.ts`'s `apiFetch()` จะลอง refresh access token ให้อัตโนมัติ 1 ครั้งเมื่อเจอ 401 ก่อนจะยอม fail จริง
- กฎเรื่องสิทธิ์ต่างๆ ถูกบังคับใช้ **ที่ฝั่ง backend จริง** ไม่ใช่แค่ซ่อนปุ่มฝั่ง UI เท่านั้น — `canManageJob()` ใน `backend/src/routes/serviceJobs.ts` คือจุดเดียวที่ตัดสินว่า "user คนนี้แก้ไข/ลบ/แนบไฟล์ในงานนี้ได้มั้ย" (ต้องเป็นผู้แจ้ง, เป็นหนึ่งในผู้รับผิดชอบ, หรือเป็น `ADMIN` — ส่วน `SALES` จะถูกปฏิเสธเสมอไม่ว่าจะเป็นผู้แจ้ง/ผู้รับผิดชอบหรือไม่ก็ตาม) การสร้างงานใหม่และการเพิ่ม/แก้ไข/ลบลูกค้าก็ถูกบล็อกแยกต่างหากสำหรับ `SALES` ที่ระดับ route เช่นกัน `SALES` ยังถูกกรองออกจากตัวเลือกผู้รับผิดชอบใน `JobCreateModal`/`JobEditModal` ด้วย เพราะ role นี้ไม่ได้ลงพื้นที่ทำงานจริง

### รายละเอียดเฉพาะของ ServiceJob
- รูปแบบ `jobNo` คือ `SR` + ปีเดือนปัจจุบัน + เลขวิ่ง (เช่น `SR202608139`) สร้างโดย `backend/src/services/jobNo.ts` ตัวนับเป็นแถวเดียวต่อเนื่อง (`JobSequence` ที่คีย์ `'GLOBAL'`, ไม่ได้รีเซ็ตรายเดือนแม้ชื่อคอลัมน์ยังเป็น `yearMonth` อยู่ก็ตาม) — ถ้าจะเปลี่ยนเลขเริ่มต้นต้องไปแก้ค่า `lastNumber` ในแถวนั้นตรงๆ เพราะค่าคงที่ `STARTING_NUMBER` ในโค้ดมีผลแค่ตอนสร้างแถวครั้งแรกเท่านั้น
- งานหนึ่งงานมีผู้รับผิดชอบได้หลายคนผ่าน `ServiceJobAssignee` — body ตอนสร้าง/แก้ไขงานใช้ `assigneeIds: string[]` ส่วน response จะ flatten join row ให้เป็น `assignees: UserSummary[]` ผ่าน `serializeJob()` ผู้เรียกใช้จะไม่เห็นโครงสร้างตาราง join เลย
- งานประเภท `OTHER` จะเก็บข้อความที่ระบุเองไว้ใน `ServiceJob.typeOther` แยกจาก `description` — `formatServiceType()` ใน `frontend/src/lib/serviceJobLabels.ts` เป็นจุดเดียวที่แสดงผลเป็น `OTHER (ข้อความที่ระบุ)` ส่วนงานประเภทอื่นทั้งหมด (`WARRANTY`, `MA_SERVICE`, `PERCALL`) ใช้ฟิลด์เดียวกันนี้เก็บตัวเลือก checkbox CM/PM ที่ติ๊กไว้ (เก็บเป็นข้อความ `"CM, PM"`) แล้วแสดงผลด้วย pattern เดียวกันเป็น เช่น `MA SERVICE (CM, PM)`
- แนบไฟล์ได้หลายไฟล์ต่องาน (อัปโหลดพร้อมกันได้หลายไฟล์ในคำขอเดียว, รองรับเฉพาะรูปภาพ/PDF/Word, จำกัด 100MB ต่อไฟล์) เมทาดาต้าเก็บอยู่ใน `Attachment` (join กับ `ServiceJob` ผ่าน `jobNo`) ส่วนตัวไฟล์จริงเก็บบนดิสก์ที่ `backend/uploads/<uuid+นามสกุล>` ผ่าน `backend/src/services/attachmentStorage.ts` การอัปโหลด/ลบไฟล์ต้องผ่าน `canManageJob` ส่วนการดาวน์โหลด (ทีละไฟล์หรือดาวน์โหลดหลายไฟล์เป็น .zip) เปิดให้ผู้ใช้ที่ login แล้วทุกคน — โปรเจคก็มีไฟล์แนบหลายไฟล์แบบเดียวกัน (`ProjectAttachment`, `backend/src/routes/projectAttachments.ts`) การอัปโหลด/ลบไฟล์แนบทั้งสองแบบถูกบันทึกลง audit log (`attachment.*` / `project_attachment.*`) เช่นเดียวกับการเพิ่ม/แก้ไข/ลบ/นำเข้าอุปกรณ์ของโปรเจค (`equipment.*`, `backend/src/routes/projectEquipment.ts`) — จงใจไม่บันทึกการดาวน์โหลด/เปิดดูไฟล์ เพราะเกิดถี่เกินไปในการใช้งานจริงและจะทำให้ audit log บวมเร็ว
- หน้าติดตามงานสำหรับลูกค้า (`/track/:shareToken`, อยู่ใน `backend/src/routes/publicJobs.ts`) ตั้งใจใช้ฟิลด์ `shareToken` แบบสุ่ม ไม่ใช่ `jobNo` ที่เรียงลำดับได้ — route นี้ไม่มี preHandler `authenticate` และคืนค่าเฉพาะฟิลด์ที่คัดมาแล้วเท่านั้น (ไม่มีชื่อผู้แจ้ง/ผู้รับผิดชอบ)

### ส่วนหน้าตาแอป (Frontend chrome)
- `Layout.tsx` ตรึงเมนูด้านซ้ายและแถบบนไว้กับหน้าจอเสมอ (`h-screen overflow-hidden`) แต่ละหน้าที่มีตาราง (`Tasks`, `Customers`, `Team`, `Reports`) จะเลื่อนเฉพาะส่วนตารางของตัวเอง (`min-h-0 flex-1 overflow-auto` พร้อม `<thead>` แบบ `sticky top-0`) ไม่ใช่เลื่อนทั้งหน้า
- ธีมมืดเป็นการสลับ class `.dark` เอง (`frontend/src/lib/theme.ts`, ประกาศ `@custom-variant dark` ไว้ใน `index.css`) ไม่ได้อิงแค่ `prefers-color-scheme` ของเบราว์เซอร์ ส่วน popup ของ `<select>` แบบ native ต้องใช้ CSS property `color-scheme` *ร่วมกับ* fallback `.dark option { background-color; color }` ด้วย เพราะแค่ `color-scheme` อย่างเดียวไม่ทำให้ popup เปลี่ยนธีมได้ในทุกเบราว์เซอร์
- ESLint rule `set-state-in-effect` ของ `eslint-plugin-react-hooks` จะฟ้องถ้ามีการเรียก `setState` เป็นบรรทัดแรกของฟังก์ชันที่ถูกเรียกจาก `useEffect` — แก้โดยจัดโครงสร้างใหม่ให้บรรทัดแรกเป็น `await` (แนะนำ) หรือใช้ `eslint-disable-next-line` เฉพาะจุดสำหรับ pattern fetch-on-mount ปกติ

### Request validation และ shared types
- ทุก route ที่รับ `body`/`querystring`/`params` ใช้ Zod schema ผ่าน `fastify-type-provider-zod` (`FastifyPluginAsyncZod` แทน `FastifyPluginAsync` ปกติ) — `app.setValidatorCompiler`/`setSerializerCompiler` ถูกตั้งแบบ global ใน `app.ts` แต่จะมีผลเฉพาะ route ที่ประกาศ `schema` เท่านั้น (route อัปโหลด/ดาวน์โหลดไฟล์แบบ multipart/binary ไม่ได้ประกาศ schema จึงไม่โดนผลกระทบ) error จาก Zod ถูก custom error handler ใน `app.ts` แปลงกลับมาเป็นรูปแบบ `{ error: string }` เดียวกับ error อื่นๆ ในแอป (รวม field path + message คั่นด้วย comma)
- `@fastify/swagger` (ตั้งค่าไว้ใน `app.ts` ด้วย `transform: jsonSchemaTransform`) แปลง Zod schema ของทุก route เป็น OpenAPI spec ให้อัตโนมัติ — `backend/scripts/generate-openapi.ts` (รันผ่าน `npm run openapi:generate`) เขียนออกมาเป็น `<repo root>/openapi.json` แล้ว `frontend`'s `npm run api-types:generate` (ใช้ `openapi-typescript`) แปลงไฟล์นั้นเป็น `frontend/src/lib/api-types.generated.ts`
- **ทั้ง `openapi.json` และ `api-types.generated.ts` ต้อง commit เข้า git** เพราะขั้นตอนสร้าง `openapi.json` ต้องมี Postgres ต่ออยู่จริง (CI ไม่มี DB จริงให้ต่อ จึงรันขั้นตอนนี้ใน CI ไม่ได้) — เวลาแก้ Zod schema ของ route ไหนแล้วอยากอัปเดต type ฝั่ง frontend ต้องรันสองคำสั่งนี้มือ: `npm run openapi:generate` (backend, ต้องมี dev server หรืออย่างน้อย Postgres รันอยู่) แล้วตามด้วย `npm run api-types:generate` (frontend)
- โค้ด frontend ที่มีอยู่เดิมยังไม่ได้ย้ายไปใช้ type จาก `api-types.generated.ts` — ยังใช้ type มือเขียนใน `frontend/src/lib/types.ts` เหมือนเดิม การย้ายไปใช้ type ที่ generate มาเป็นงานแยกที่ยังไม่ได้ทำ (ทำได้ทีละไฟล์แบบเดียวกับตอน split god file)

### จุดที่ต้องระวังบน Windows
- `prisma generate` / `migrate dev` จะ error แบบ `EPERM` ตอน rename ไฟล์ query-engine `.dll.node` ถ้ามี process node ตัวไหน (dev server หรือ process ค้างอยู่) ยังเปิดไฟล์นั้นอยู่ — ต้องปิด process นั้นก่อน
- process `npm run dev` ที่รันเบื้องหลังบางทีไม่ตายสนิทบน Windows — เช็คด้วย `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` แล้ว kill เฉพาะ PID ที่เจาะจง อย่า kill รวมทั้งหมด
- การเพิ่มคอลัมน์แบบ required ที่มีค่า default กำหนดจากฝั่งแอป (ไม่ใช่ default ระดับ DB) ลงในตารางที่มีข้อมูลอยู่แล้ว จะทำให้ `prisma migrate dev` ปฏิเสธการรันแบบ non-interactive — ต้องเขียน migration SQL เอง (backfill ข้อมูลก่อนค่อย `SET NOT NULL`) แล้ว reconcile ประวัติด้วย `prisma migrate resolve --applied` คำสั่งนี้แค่ทำเครื่องหมายว่า apply แล้วในประวัติเท่านั้น **ไม่ได้รัน SQL จริงให้** ต้องรัน SQL นั้นกับฐานข้อมูลเองแยกต่างหาก

# Admin Plan

Tujuan: semua halaman role `admin` di app Nuxt yang sama, di bawah `/admin/*`.
Tidak ada link ke admin dari `/` — admin masuk manual lewat URL `/admin`.

Sumber scope: PRD §6 (issue resolution), §7 (refund), API.md §6, ARCHITECTURE §3
("`/admin/*` — on-hold orders, pending refunds, failed payouts").

> Menyembunyikan link bukan pengaman. Keamanan tetap di server: semua `/api/admin/*`
> sudah lewat `requireAdmin` (cek `profiles.role = 'admin'`). Middleware client hanya UX.

---

## 1. Halaman

| Route | Isi | API |
|---|---|---|
| `/admin` | Login admin (email + password) | Supabase auth, lalu `GET /api/me` |
| `/admin/orders` | Tab **On hold** (default) / **Semua**. List order: buyer, no. order, status, total, tanggal lapor | `GET /api/admin/orders?on_hold=true` |
| `/admin/orders/[id]` | Detail order: item, catatan issue, bukti kirim, payment, refund, payout. Aksi **Release dana** & **Batalkan (alasan)** kalau on hold | `GET /api/admin/orders/:id`, `POST .../release`, `POST .../cancel` |
| `/admin/refunds` | Tab **Menunggu transfer** / **Sudah transfer**. Info kontak buyer + jumlah. Aksi **Tandai sudah ditransfer** (input `transfer_reference`) | `GET /api/admin/refunds`, `POST /api/admin/refunds/:id/mark-transferred` |
| `/admin/payouts` | Tab **Gagal** (default) / **Semua**. Alasan gagal, attempt. Aksi **Retry** | `GET /api/admin/payouts?status=failed`, `POST .../retry` |
| `/admin/payments` | Payment orphaned (sudah bayar tapi order sudah batal) → perlu refund manual | `GET /api/admin/payments/orphaned` |

Sengaja **tidak** dibuat:
- Dashboard/statistik — tidak ada di PRD. `/admin` langsung redirect ke `/admin/orders` setelah login.
- Halaman edit `PlatformConfig` — DATA_MODEL bilang di-edit via Supabase Table Editor.
- Manajemen user/role — admin di-set manual di Supabase (PRD).

Aturan UI: ikuti gaya seller (`seller-page`, `seller-page-title`, komponen `app/components/ui/*`,
Tailwind token yang sama). Tanpa teks deskripsi/subtitle di bawah judul halaman.

## 2. Auth & layout

- **`app/pages/admin/index.vue`** — login pakai `AuthShell` (subtitle "Masuk sebagai Admin").
  Setelah `signInWithPassword` → `$fetch('/api/me')`; kalau `role !== 'admin'` → `signOut()`
  dan tampilkan "Akun ini bukan admin." Kalau sudah login sebagai admin → redirect ke `/admin/orders`.
- **`app/middleware/admin.ts`** — belum login → `/admin`; login tapi bukan admin → `/admin`
  (dengan pesan). Role diambil dari `/api/me` via `useFetch` dengan key `admin-me` supaya cached.
- **`app/layouts/admin.vue`** — salinan `seller.vue` yang dipangkas: label "Admin",
  nav (Pesanan, Refund, Payout, Payment), tanpa gating trip, menu profil hanya "Keluar"
  (→ `/admin`). Badge jumlah di nav untuk on-hold / pending refund / failed payout
  opsional, tambah belakangan kalau perlu.
- Ekstrak sidebar bersama seller/admin **nanti saja** kalau muncul layout ketiga.
- `useHead({ meta: [{ name: 'robots', content: 'noindex' }] })` di layout admin.

## 3. Backend yang perlu diperbaiki/ditambah dulu

1. ✅ **Bug: release/cancel admin selalu 409.** `getAdminOrder` & `listAdminOrders`
   (`server/repositories/order.repository.ts`) memakai `orderFields`, yang tidak memuat
   `issue_reported_at`/`issue_resolved_at`/`issue_note`. Ganti ke `sellerOrderFields`
   + join `refunds(*)`, `payments(*)`, `payouts(*)`.
2. ✅ **Bukti kirim**: tidak perlu signed URL — seller mengisi `shipping_evidence_url` sebagai
   URL publik `https://...`, bukan upload ke bucket `shipping-proof`. Detail admin menampilkan
   link dengan validasi protokol yang sama seperti halaman seller.
3. ✅ **Admin cancel belum membuat refund** (`cancel.post.ts` mengembalikan `refund: null`).
   Kalau order sudah dibayar: buat refund `admin_cancel` = item aktif yang belum di-refund
   + platform fee penuh, channel fee 0 (AC-6.5, AC-7.4, AC-7.5). Hitungan dibuat sebagai
   fungsi murni + satu test di `tests/` (jalur uang). Tandai item aktif jadi cancelled.
4. ✅ **Transisi kondisional**: `updateAdminOrder` untuk release/cancel ditambah
   `.is('issue_resolved_at', null)` (+ `.in('status', [...])` untuk release), 0 baris → 409.
   Sesuai ARCHITECTURE §4, aman dari double-click.
5. ✅ **Endpoint baru refund**:
   - `GET /api/admin/refunds?status=pending_transfer` → refund + `orders(order_number,buyer_name,buyer_email,buyer_phone)`.
   - `POST /api/admin/refunds/:id/mark-transferred` body `{ transfer_reference }` →
     update kondisional `status = pending_transfer` → `transferred`, isi `transferred_at/by`,
     email buyer; kedua kali → 409 (AC-7.7).
6. ✅ **Payout list**: join `orders(order_number)`; nama pakai snapshot `account_holder_name`.
   Payment orphaned juga di-join ke nomor order + kontak buyer.
7. ✅ **Hapus `server/middleware/admin-cors.ts` + `adminAppOrigin`** — itu untuk admin SPA
   terpisah; admin sekarang satu origin dengan app ini. Jalur `Authorization: Bearer` di
   `requireUser` ikut dihapus (hanya dipakai admin SPA).
8. Email ke admin (issue reported, payout failed) sudah di scope PRD; cek terpisah, bukan
   bagian halaman.

## 4. Urutan kerja (✅ semua sudah dikerjakan, belum di-commit)

1. Backend §3.1, §3.4 (bug fix, kecil) → test manual release/cancel via curl.
2. Auth: `middleware/admin.ts`, `pages/admin/index.vue`, `layouts/admin.vue`.
3. `/admin/orders` + `/admin/orders/[id]` (+ §3.2, §3.3).
4. §3.5 lalu `/admin/refunds`.
5. §3.6 lalu `/admin/payouts`.
6. `/admin/payments`.
7. §3.7 cleanup CORS.

Satu commit per langkah di branch `feat/admin`.

## 5. Checklist acceptance

- [x] Akses `/admin/*` tanpa login → ke `/admin`; login non-admin → ditolak & di-signout.
- [ ] `/api/admin/*` tanpa role admin → 403 (sudah ada, jangan sampai hilang).
- [ ] Release on-hold order `delivered` → `completed`, payout dibuat; `processing` → ditolak (AC-6.4).
- [ ] Cancel on-hold paid order → refund `admin_cancel` benar (AC-6.5, AC-7.4), total ≤ subtotal + platform fee (AC-7.5).
- [ ] Tandai refund ditransfer → email buyer; kedua kali 409 (AC-7.7).
- [ ] Retry payout gagal → `attempt` naik; payout non-failed → 409.
- [ ] Payment orphaned tampil dan bisa ditelusuri ke order-nya.
- [x] Tidak ada link/tombol admin di `/`.
- [ ] Layout rapi di lebar mobile (sidebar collapse seperti seller).

## 6. Sisa / belum ada

- Pembayaran terlambat (orphaned) tidak bisa ditandai "sudah direfund" — tetap muncul di list.
  Tambah kolom/endpoint kalau list mulai ramai.
- Alur setelah login admin belum dites end-to-end (butuh akun `role = admin`).

# Deadline Cron Setup

Daigow memiliki endpoint:

```text
POST /api/cron/process-deadlines
```

Endpoint ini memproses:

- Order yang melewati batas konfirmasi.
- Order yang melewati batas pembayaran.
- Payment yang kedaluwarsa.
- Auto-complete order setelah 72 jam.
- Payout setelah auto-complete.

## Environment variable Vercel

Tambahkan di **Vercel → Settings → Environment Variables**:

```text
CRON_SECRET=<random-secret-minimal-16-karakter>
```

Gunakan nilai yang sama saat mengatur scheduler. Jangan masukkan secret ke Git atau URL.

## Rekomendasi: cron-job.org

Vercel Hobby hanya mendukung cron harian. Karena Daigow membutuhkan pemeriksaan setiap 15 menit, gunakan cron-job.org atau scheduler HTTP lain.

Buat job baru dengan konfigurasi:

```text
URL: https://daigow-sparta.vercel.app/api/cron/process-deadlines
Method: POST
Schedule: Every 15 minutes
Header: cron-secret: <nilai CRON_SECRET>
```

Jangan menambahkan trailing slash pada URL.

## Pengujian manual

PowerShell:

```powershell
$headers = @{ 'cron-secret' = '<nilai-CRON_SECRET>' }
Invoke-RestMethod -Method Post -Uri 'https://daigow-sparta.vercel.app/api/cron/process-deadlines' -Headers $headers
```

Response normal berbentuk:

```json
{
  "confirmation_cancelled": 0,
  "payment_cancelled": 0,
  "payments_expired": 0,
  "auto_completed": 0,
  "payout_failed": 0
}
```

## Verifikasi setelah aktif

- Pastikan job menghasilkan HTTP 200.
- Periksa Vercel Function Logs setelah jadwal pertama.
- Buat data test yang melewati deadline dan pastikan status berubah.
- Pastikan `payout_failed` dipantau karena dapat berarti rekening seller belum valid.

## Alternatif Vercel Pro

Jika project memakai Vercel Pro, cron dapat dikonfigurasi melalui `vercel.json` dengan schedule `*/15 * * * *`. Vercel mengirim `CRON_SECRET` melalui header `Authorization: Bearer ...`; route perlu menerima format tersebut sebelum opsi ini digunakan.

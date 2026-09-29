# Email Notifications — Daigow

Catatan backlog untuk melengkapi email transaksional sesuai PRD.

## Status saat ini

- Resend sudah terhubung melalui `server/utils/mailer.ts`.
- Email dikirim menggunakan `RESEND_API_KEY`.
- Pengirim dikonfigurasi melalui `RESEND_FROM_EMAIL`.
- Link tracking order memakai `PUBLIC_APP_URL`.
- Error email tidak menggagalkan transaksi utama.

Environment variable yang diperlukan:

```env
RESEND_API_KEY=
RESEND_FROM_EMAIL=Daigow <noreply@domain-terverifikasi.com>
PUBLIC_APP_URL=https://daigow-sparta.vercel.app
```

## Email yang sudah memiliki trigger

- Buyer membuat order → email order diterima dan link tracking.
- Seller mengonfirmasi order → email instruksi pembayaran.
- Seller menolak order → email alasan penolakan.
- Seller mengirim order → email status pengiriman.
- Seller menandai order delivered → email konfirmasi penerimaan.
- Seller membatalkan item → email informasi refund.
- Admin membatalkan order → email informasi refund.
- Admin menandai refund ditransfer → email referensi transfer.
- Order melewati batas konfirmasi → email pembatalan otomatis.
- Order melewati batas pembayaran → email pembatalan karena pembayaran kedaluwarsa.

## Email yang belum memiliki trigger

### Buyer

- Pembayaran berhasil → status pembayaran dan order masuk proses.
- Order selesai → payout sudah diproses ke seller.
- Order dibatalkan karena issue → informasi pembatalan dan refund.

### Seller

- Order baru dibuat → permintaan konfirmasi order.
- Pembayaran buyer berhasil → seller dapat mulai memproses order.
- Buyer melaporkan issue → order sedang ditahan.
- Payout berhasil → jumlah dan nomor order.
- Payout gagal → alasan kegagalan dan instruksi memperbaiki rekening.

### Admin

- Buyer melaporkan issue → order perlu ditinjau.
- Payout gagal → payout perlu diperiksa atau di-retry.

### Subscriber Trip

- Trip dibuka → katalog sudah bisa dipesan.

## Rekomendasi implementasi

1. Buat helper template email agar subject dan isi konsisten.
2. Gunakan URL absolut dari `PUBLIC_APP_URL` untuk semua link.
3. Ambil email seller dari profile pemilik Trip atau Order.
4. Kirim email hanya setelah conditional update berhasil.
5. Panggil email secara aman agar kegagalan Resend tidak membatalkan transaksi.
6. Tambahkan test untuk setiap event dan penerima.
7. Uji duplicate webhook supaya email tidak terkirim dua kali.

## Acceptance checklist

- [ ] Pembayaran berhasil mengirim email ke seller.
- [ ] Order baru mengirim email ke seller.
- [ ] Issue mengirim email ke admin.
- [ ] Issue mengirim email status hold ke buyer/seller sesuai kebutuhan.
- [ ] Trip open mengirim email ke setiap subscriber satu kali.
- [ ] Order completed mengirim email ke buyer.
- [ ] Payout succeeded mengirim email ke seller.
- [ ] Payout failed mengirim email ke seller dan admin.
- [ ] Email tidak terkirim ulang saat webhook duplikat.
- [ ] Semua link email mengarah ke domain production.
- [ ] Domain pengirim Resend tetap terverifikasi.

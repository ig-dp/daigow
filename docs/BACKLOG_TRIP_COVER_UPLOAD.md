# Backlog: Upload Cover Image Trip

## Tujuan

Memungkinkan seller mengganti cover trip melalui upload gambar atau URL gambar.

## Rencana implementasi

- Tambahkan pilihan **Upload gambar** dan **Gunakan URL** pada panel Cover Image di halaman edit trip.
- Simpan file ke Supabase Storage bucket `trip-covers` dengan path seller/trip.
- Simpan URL publik hasil upload ke kolom `trips.thumbnail_url` melalui endpoint PATCH yang sudah ada.
- Tampilkan preview cover sebelum disimpan.
- Validasi tipe file gambar, ukuran file, URL, loading, dan error upload.
- Tambahkan migration bucket serta policy Storage bila bucket belum tersedia.

## Status

Ditunda sampai selesai presentasi produk.

# Prototipe Sistem Kontrol Operasional (PRD v1.2)

Prototipe klik-able untuk 5 modul di PRD v1.2: **Client + Area + Site Management**, **SPK + FPK / memo eksternal**, **People in Act**, **Notifikasi**, dan **RBAC**.
Tujuannya untuk validasi alur ke user dan contoh layar untuk tim dev. **Kalau prototipe dan PRD berbeda, yang berlaku PRD.**

- Semua data di prototipe ini **fiktif** (nama orang, klien, site, nomor dokumen, nilai uang).
- Tidak ada backend: data disimpan di memori browser dan kembali ke awal saat halaman dimuat ulang (atau lewat menu user → *Reset data contoh*).
- Tanggal simulasi: **12 Nov 2026** (`src/domain/time.ts`). Klik chip tanggal di kiri atas untuk menjalankan job harian atau memajukan tanggal 1/7/30 hari (SPK berakhir, tugas memo H-75, pengingat kejar SPK hari ke-7/14/21, eskalasi). "Reset data contoh" mengembalikan tanggal ke 12 Nov 2026.

## Menjalankan

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint     # cek tipe TypeScript
npm run build
```

Deploy ke Vercel: `vercel.json` sudah berisi rewrite SPA, jadi link langsung dan refresh tidak 404.

## Cara mencoba

Ganti user simulasi lewat tombol nama di kanan atas. Menu, aksi, dan field uang mengikuti peran user.

| User | Peran | Yang bisa dicoba |
|---|---|---|
| Sari Melati | Marketing | Buat FPK (termasuk klien/site baru), perbaiki FPK 0011 yang dikembalikan (versi baru + review ulang otomatis), input/revisi SPK |
| Yudha Pratama | Marketing (kepala), wakil BOD | Tidak bisa menyetujui FPK 0012 karena dia pembuatnya |
| Dewi Anggraini / Bagas Wirawan | Operasional | Cek FPK, lepas personel untuk mutasi FPK 0009 (Dewi, area Tangerang) |
| Fajar Ramadhan | Recruitment | Cek FPK 0013 (sumber personel per baris), serahkan calon ke HR (FPK 0009) |
| Lina Marlina | HR | Tandai terdaftar, tempatkan standby, ubah penempatan mutasi |
| Agus Setiono | PIC Area (Jakarta) | Konfirmasi mulai jaga FPK 0007 dari HP |
| Nanda Putri | Pengadaan | Cek FPK 0013 |
| Wulan Sari / Teguh Santoso | Finance | Cek margin FPK 0006, verifikasi SPK/CLA/2026/031 (ada field beda) |
| Hartono Wibisono | BOD | Menunggu keputusan saya: FPK 0012 (margin rendah + tidak layak), persetujuan memo, eskalasi; alihkan tugas |
| Yudha Pratama (memo) | Marketing | Memo H-75 untuk SPK/KTM/2025/007 (data awal), catat jawaban klien MEMO/2026/0021, input SPK perpanjangan |
| Kevin Halim | Admin sistem | Master data, user & peran, divisi terkait, pengaturan & libur, audit log (nilai uang disamarkan) |

## Struktur

```
src/domain/   model data, aturan (RBAC, hari kerja, review ulang, jalan tanpa SPK), data contoh
src/store/    state + aksi (master data, FPK, SPK, persiapan personel)
src/pages/    layar per modul
src/ui/       komponen tampilan
```

## Belum ada di prototipe

- Import Excel (prioritas rendah di PRD)
- Login, undangan, reset sandi, dan kunci akun sungguhan (diganti tombol ganti user simulasi)
- Email notifikasi dan ringkasan pagi (notifikasi di aplikasi sudah ada)
- Dashboard eksekutif (di luar PRD Rilis 1)

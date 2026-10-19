# Panduan Penggunaan Neraca

Neraca membantu mencatat keuangan pribadi secara manual: uang yang tersedia,
pengeluaran, aset, utang, anggaran, dan target. Setiap pengguna memiliki data
sendiri di browser masing-masing. Mengunduh kode dari GitHub tidak memberikan
akses ke data pengguna lain.

## 1. Jalankan aplikasi

Ikuti bagian Quick start pada [README](../README.md). Gunakan alamat dan profil
browser yang sama setiap kali membuka aplikasi agar data lokal tetap ditemukan.
Antarmuka memakai bahasa Indonesia dan mata uang dasar rupiah.

## 2. Tambahkan rekening dan saldo awal

Buka **Aset**, lalu tambahkan rekening pada **Rekening & Kas**. Pilih jenis bank,
tunai, atau e-wallet. Masukkan saldo awal saat mulai mencatat.

Saldo rupiah GoPay, OVO, maupun exchange dimasukkan sebagai rekening e-wallet.
BTC, ETH, USDT, kendaraan, dan properti masuk ke **Aset non-rekening**.
Jangan mencatat uang yang sama di kedua tempat karena total aset akan terhitung
dua kali. Jika saldo IDR terlanjur menjadi aset likuid manual, gunakan
**Ke rekening**, periksa pratinjaunya, dan buat backup terlebih dahulu.

## 3. Catat pemasukan dan pengeluaran

Pilih **Catat transaksi**, isi jenis, tanggal, nominal, rekening, kategori, dan
catatan. Transaksi pengeluaran memakai rekening sebagai sumber dana. Gunakan
tombol **Ubah** untuk membetulkan transaksi biasa yang salah.

Tanggal adalah tanggal kejadian. Validasi pengeluaran menggunakan saldo yang
tercatat pada tanggal tersebut. Jika saldo sekarang Rp250.000 tetapi pada tanggal
yang dipilih baru Rp20.000, pengeluaran Rp50.000 pada tanggal itu akan ditolak.
Periksa tanggal top-up, transfer, saldo awal, dan rekonsiliasi sebelum mengubah
catatan. Jangan menambah pemasukan palsu hanya untuk melewati validasi.

Transaksi bertanggal masa depan dapat dicatat sebagai jadwal. Saldo hari ini
belum berubah sampai tanggalnya, tetapi catatan tersebut dapat muncul pada
ringkasan periode dan perhitungan komitmen.

## 4. Pindahkan uang antarrekening

Gunakan **Pindahkan saldo** untuk transfer dari bank ke e-wallet atau antar
rekening sendiri. Contoh sintetis: pindahkan Rp100.000 dari rekening bank ke
e-wallet. Saldo bank turun Rp100.000 dan e-wallet naik Rp100.000. Transfer internal
tidak dihitung sebagai pemasukan atau pengeluaran.

## 5. Catat aset dan kripto

**Tambah aset** digunakan untuk kepemilikan yang sudah ada. **Beli aset**
digunakan saat pembelian baru perlu mengurangi sumber dana. Pilih aset tujuan
yang sudah ada untuk menambah kepemilikan, atau buat aset baru.

Untuk BTC, ETH, atau USDT, pilih metode harga live, masukkan modal rupiah dan
harga beli dalam USD. Jumlah koin diperkirakan dari modal, harga beli, dan kurs
yang tersedia. Nilai tampilan mengikuti harga publik; modal tersimpan tidak
berubah hanya karena harga pasar bergerak. Harga pasar umum dapat berbeda dari
harga exchange, spread, biaya, atau kurs transaksi sebenarnya.

Gunakan **Jual** untuk mencatat hasil jual, biaya, dan rekening penerima.
Penjualan kripto juga meminta harga jual USD dan kurs yang dapat dikoreksi.
Gunakan **Cocokkan saldo** jika jumlah koin di exchange berbeda karena riwayat
lama belum lengkap. Fitur ini membetulkan kepemilikan tanpa mencatat penjualan
atau mengubah saldo IDR secara otomatis. Jika modal tersisa tidak diketahui,
penyesuaian proporsional hanyalah perkiraan, bukan perhitungan laba trading
yang lengkap.

Untuk aset manual, **Ubah detail** membetulkan data aset; **Perbarui nilai**
mencatat nilai terbaru tanpa membuat pemasukan atau pengeluaran.

## 6. Buat anggaran dan transaksi rutin

Di **Anggaran**, pilih kategori dan batas untuk periode aktif. **Salin ke bulan
berikutnya** menyalin anggaran tanpa menimpa kategori yang sudah ada. Gunakan
pola anggaran untuk kebutuhan yang berulang mulai bulan tertentu.

Di **Transaksi**, buat pola pemasukan atau pengeluaran rutin, tentukan rekening,
nominal, tanggal tiap bulan, dan bulan mulai. Pilih periode yang diinginkan lalu
tekan **Buat bulan ini** untuk menerapkannya. Pola bukan pembayaran otomatis ke
bank atau e-wallet. Periksa catatan yang dihasilkan sebelum menganggapnya
sebagai transaksi yang sudah terjadi.

## 7. Atur dana aman dan target

Di Dashboard, cari bagian **Berapa uang yang benar-benar bisa dipakai?** lalu
atur target dana darurat, tanggal pemasukan berikutnya, dan kategori kebutuhan
pokok. Dana aman memperhitungkan kas operasional dan komitmen; nilai investasi
kripto tidak dianggap sebagai uang belanja operasional.

Di **Target keuangan**, pilih progres manual atau tautkan ke rekening/aset.
Menautkan target tidak memindahkan atau mengunci uang. Analisis memakai aturan
dari catatan lokal; riwayat yang belum lengkap dapat menghasilkan perkiraan
yang kurang mewakili kondisi sebenarnya.

## 8. Periksa saldo dan buat backup

Gunakan **Cek saldo** pada rekonsiliasi rekening untuk membandingkan saldo
tercatat dengan saldo sebenarnya. Selisih dapat disimpan untuk diperiksa atau
diterapkan sebagai koreksi mulai tanggal pengecekan. Koreksi lama sebelum
dukungan tanggal tetap mengikuti pencatatan saldo dasar yang lama.

Buka **Backup & Pengaturan** dan unduh JSON secara berkala, terutama sebelum
update atau pindah perangkat. CSV hanya berisi transaksi dan bukan pengganti
backup JSON seluruh aplikasi. Restore dilakukan secara eksplisit melalui menu
yang sama; periksa dialog konfirmasi sebelum melanjutkan.

Data terikat pada kombinasi protokol, hostname, port, dan profil browser.
`localhost:3000` dan `localhost:3001` memiliki penyimpanan berbeda. Jika data
terlihat hilang, periksa alamat dan profil browser dahulu. Simpan backup JSON
secara pribadi karena aplikasi tidak mengenkripsi berkas tersebut.

## Keterbatasan

Harga live perlu koneksi internet. Saat pembaruan gagal, aplikasi dapat memakai
harga terakhir atau nilai tercatat dan menampilkan statusnya. Tidak ada login,
sinkronisasi perangkat, integrasi bank, atau pengiriman data keuangan ke server.
Laporan aset bulan lampau belum selalu merekonstruksi nilai aset pada tanggal
tersebut. Aplikasi ini membantu pencatatan pribadi dan belum merupakan buku
besar akuntansi historis yang lengkap.

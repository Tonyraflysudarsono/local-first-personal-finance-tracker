# Instalasi, Update, dan Pemulihan Data

Panduan ini untuk menjalankan Neraca di komputer sendiri. Kode tersedia di
GitHub; setiap pengguna memiliki data lokal sendiri. Tidak perlu mendaftarkan
akun aplikasi, memasukkan API key, atau menyiapkan database server.

## 1. Siapkan Git dan Node.js

Pasang [Git](https://git-scm.com/downloads) dan
[Node.js](https://nodejs.org/en/download) versi yang memenuhi kebutuhan proyek
(minimal 22.13). npm disertakan pada instalasi Node.js. Setelah instalasi,
tutup dan buka kembali terminal agar perintahnya tersedia.

Periksa dari Command Prompt atau PowerShell:

```text
git --version
node --version
npm --version
```

Jika PowerShell menolak `npm.ps1`, gunakan `npm.cmd` untuk semua perintah npm
di bawah, misalnya `npm.cmd ci` dan `npm.cmd run dev`. Tidak perlu mengubah
execution policy hanya untuk menjalankan aplikasi ini.

## 2. Unduh dan jalankan

Buka terminal pada folder tempat kamu ingin menyimpan proyek, lalu jalankan
perintah berikut satu per satu:

```bash
git clone https://github.com/Tonyraflysudarsono/local-first-personal-finance-tracker.git
cd local-first-personal-finance-tracker
npm ci
npm run dev
```

`npm ci` membutuhkan internet untuk mengunduh paket sesuai lockfile. Setelah
terminal menunjukkan URL lokal, buka `http://localhost:3000` atau alamat yang
tercantum. Biarkan terminal tetap berjalan selama memakai Neraca.

Jika muncul pesan port sudah dipakai, periksa apakah Neraca sudah berjalan di
terminal lain. Buka proses yang sudah berjalan atau hentikan proses itu dengan
`Ctrl+C` sebelum memulai lagi. Server tidak otomatis berpindah port karena
alamat dengan port lain mempunyai penyimpanan browser yang berbeda.

Pada penggunaan pertama, tambahkan rekening dan saldo awal. Lanjutkan ke
[panduan penggunaan](USER_GUIDE.id.md) untuk transaksi, anggaran, dan aset.

## 3. Menutup dan membuka kembali

Tekan `Ctrl+C` pada terminal untuk menghentikan server. Untuk membuka kembali:

```bash
cd local-first-personal-finance-tracker
npm run dev
```

Jalankan perintah `cd` dari folder induk proyek, atau langsung buka terminal di
dalam folder proyek. Kamu tidak perlu mengulang clone atau `npm ci` setiap kali.
Data tetap berada di browser meskipun server dihentikan.

## 4. Jalankan hasil build

```bash
npm run build
npm start
```

Mode ini juga memakai `http://localhost:3000` secara default. Gunakan profil
browser dan alamat yang sama untuk menemukan data yang sudah dicatat. Memakai
`127.0.0.1` alih-alih `localhost` membuat origin berbeda.

Pengaturan port production bersifat opsional. Contoh PowerShell:

```powershell
$env:PORT = "3001"
npm.cmd start
```

Command Prompt memakai `set PORT=3001`, kemudian `npm start`. Port lain akan
menampilkan penyimpanan lokal yang terpisah. Pengaturan `HOST` hanya diperlukan
bila kamu sengaja mengubah alamat dengar server; jangan membuka development
server ke internet untuk dibagikan sebagai situs publik.

## 5. Update tanpa kehilangan catatan

1. Buka aplikasi dan unduh JSON melalui **Backup & Pengaturan**.
2. Simpan berkas itu di lokasi pribadi di luar folder repo.
3. Hentikan server dengan `Ctrl+C`.
4. Di folder proyek, jalankan `git pull --ff-only`, lalu `npm ci`.
5. Jalankan `npm run dev`, atau `npm run build` lalu `npm start` untuk production.
6. Buka profil browser dan URL yang sama, lalu periksa saldo serta transaksi.

Jika Git menolak update karena perubahan lokal, jangan memakai reset paksa.
Simpan dan tinjau perubahan tersebut dahulu. Jangan menghapus data situs browser
untuk memperbarui kode aplikasi.

## 6. Backup dan restore

JSON adalah backup seluruh aplikasi. CSV hanya untuk membaca transaksi di
spreadsheet. File backup tidak dienkripsi oleh aplikasi dan tidak boleh
diunggah ke GitHub, issue publik, atau folder bersama tanpa pertimbangan.

Untuk memindahkan data ke browser/perangkat lain:

1. Unduh backup JSON dari instalasi asal.
2. Jalankan Neraca pada instalasi tujuan.
3. Jika tujuan sudah berisi data, unduh backup tujuan terlebih dahulu.
4. Pilih **Restore dari backup**, lalu pilih JSON dan baca konfirmasinya.
5. **Restore mengganti seluruh data yang ada pada origin dan profil tujuan.**
6. Periksa rekening, transaksi, aset, dan target setelah selesai.

Data tidak disinkronkan otomatis antara dua instalasi. Jika terus memakai
keduanya, catatan masing-masing akan berkembang sendiri.

## 7. Jika data terlihat kosong atau harga tidak muncul

| Gejala | Yang perlu diperiksa |
| --- | --- |
| Data kosong setelah membuka ulang | Profil browser, `localhost` vs `127.0.0.1`, protokol, dan port harus sama |
| Browser baru tidak berisi data | Pindahkan secara eksplisit melalui backup JSON |
| Pengeluaran ditolak meski saldo sekarang cukup | Periksa saldo dan tanggal top-up pada tanggal transaksi |
| Harga BTC/ETH/USDT gagal dimuat | Periksa internet, status harga terakhir, lalu coba muat ulang setelah jeda |
| Perubahan belum tersimpan | Periksa pesan penyimpanan di aplikasi dan izin penyimpanan browser |
| Halaman gagal dibuka setelah terminal ditutup | Mulai server lagi dari folder proyek |

IndexedDB bukan pengganti backup. Menghapus data situs atau profil browser dapat
menghapus catatan lokal. PWA membantu membuka ulang app yang sudah dimuat ketika
offline, tetapi pemasangan pertama dan unduhan paket tetap memerlukan internet.

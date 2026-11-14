Sistem Informasi Sekolah - SMAN 10 Tasikmalaya
Project UTS Pemrograman WEB (HTML + CSS + JavaScript, tanpa framework)

CARA MENJALANKAN
  Buka index.html (atau login.html) di browser. Tidak perlu XAMPP/PHP/MySQL.
  Untuk publikasi: unggah seluruh isi folder ini ke Netlify / GitHub Pages / Vercel
  (index.html harus berada di root folder).

HALAMAN
  index.html   Halaman Utama (dashboard)      login.html     Login
  siswa.html   Data siswa                     guru.html      Data guru
  jadwal.html  Jadwal pelajaran               absensi.html   Absensi
  nilai.html   Rekap nilai                    input_nilai.html  Input nilai
  laporan.html Menu laporan                   kontak.html    Kontak (form kirim pesan)
  laporan_absensi_filter.html, laporan_nilai_filter.html  Filter laporan
  print_siswa / print_guru / print_absensi / print_nilai .html  Halaman cetak

STRUKTUR
  css/style.css   tampilan semua halaman (responsive)
  css/print.css   tampilan halaman cetak
  js/data.js      data contoh (pengganti database)
  js/app.js       interaksi: sidebar, filter, modal, validasi form kontak
  js/print.js     isi halaman cetak
  images/logo.png logo sekolah

CATATAN
  - Tambah/edit/hapus hanya berlaku pada halaman yang sedang dibuka (tidak disimpan permanen).
  - Ikon (Font Awesome) dan huruf (Poppins) dimuat dari CDN, jadi butuh internet.
  - Form Kontak membuka aplikasi email pengguna (mailto) setelah isian valid.

Aturan penamaan: semua class & id CSS memakai awalan 'Doniza_' (contoh: .Doniza_nav_link, #Doniza_menuBtn).

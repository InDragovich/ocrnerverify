# Project TA

Web Application ini dibangun menggunakan **React**, **Vite**, dan **Tailwind CSS**. 

Berikut adalah panduan langkah demi langkah untuk menjalankan proyek ini di komputer Anda, dimulai dari persiapan lingkungan hingga menjalankan aplikasi.

## 📋 Prasyarat

Sebelum memulai, pastikan komputer Anda telah terinstal perangkat lunak berikut:

1.  **Node.js & npm** (Runtime JavaScript dan Package Manager)
    *   Unduh dan instal versi terbaru (LTS direkomendasikan) dari [nodejs.org](https://nodejs.org/).
    *   Untuk memverifikasi instalasi, buka terminal (Command Prompt/PowerShell) dan jalankan:
        ```bash
        node -v
        npm -v
        ```
2.  **Git** (Version Control System)
    *   Unduh dan instal dari [git-scm.com](https://git-scm.com/).
    *   Untuk memverifikasi, jalankan:
        ```bash
        git --version
        ```

---

## 🚀 Cara Menjalankan Project

Ikuti langkah-langkah berikut untuk mengunduh dan menjalankan aplikasi di komputer lokal Anda:

### 1. Clone Repository
Salin kode sumber proyek ke komputer Anda. Buka terminal atau Command Prompt di folder tujuan yang Anda inginkan, lalu jalankan:

```bash
git clone <URL_REPOSITORY_ANDA>
cd project-ta
```
*(Ganti `<URL_REPOSITORY_ANDA>` dengan URL repository GitHub yang sebenarnya)*

### 2. Install Dependencies
Masuk ke direktori proyek (jika belum) dan instal semua pustaka yang dibutuhkan menggunakan npm:

```bash
npm install
```

### 3. Jalankan Aplikasi (Development Mode)
Untuk memulai server pengembangan lokal:

```bash
npm run dev
```

Setelah perintah dijalankan, terminal akan menampilkan alamat lokal (biasanya `http://localhost:5173/`). Buka alamat tersebut di browser web Anda untuk melihat aplikasi.

---

## 🛠️ Script yang Tersedia

Dalam direktori proyek, Anda dapat menjalankan perintah berikut:

- **`npm run dev`**: Menjalankan aplikasi dalam mode pengembangan. Halaman akan dimuat ulang secara otomatis jika Anda mengedit file.
- **`npm run build`**: Membuild aplikasi untuk produksi ke folder `dist`.
- **`npm run preview`**: Menjalankan preview dari hasil build produksi secara lokal.
- **`npm run lint`**: Memeriksa kode untuk menemukan potensi error menggunakan ESLint.

## 📁 Struktur Project

Web app ini menggunakan struktur folder Vite + React standard:

- `src/`: Berisi kode sumber utama (Komponen, Halaman, Logika).
- `public/`: Aset statis yang tidak diproses oleh Vite.
- `index.html`: Titik masuk aplikasi.
- `vite.config.ts`: Konfigurasi Vite.
- `tailwind.config.js` (atau terintegrasi di CSS): Konfigurasi Tailwind CSS.

---

Dibuat dengan ❤️ menggunakan [Vite](https://vitejs.dev/) & [React](https://react.dev/).

# Taralaya Business OS V1 — Deployment (VPS + PM2, no Docker)

Target: 1 VPS menjalankan backend Express (via PM2) + serving frontend build (React) lewat Nginx sebagai reverse proxy. NeonDB tetap dipakai sebagai DB (serverless Postgres, connection string tinggal dipasang, nggak perlu Postgres lokal di VPS).

Task id terkait: **p6-b4 (lanjutan)** — eksekusi deploy sesungguhnya, bukan cuma build verification.

Kenapa PM2 tanpa Docker: skala project masih single-app, single-server, single-developer. Docker baru worth it kalau nanti butuh multi-service atau multi-server. Bisa migrasi ke Docker belakangan tanpa mengubah kode aplikasi.

---

## 1. Provisioning VPS

- Pilih provider (DigitalOcean, Niagahoster, Contabo, dll — spek minimal 1 vCPU / 1GB RAM cukup buat awal).
- OS: Ubuntu LTS terbaru (paling banyak dokumentasi/tutorial tersedia).
- Setup awal wajib: buat user non-root, disable root login via SSH, setup firewall (ufw) — buka port 22 (SSH), 80 (HTTP), 443 (HTTPS) doang.

## 2. Install dependencies di server

- Node.js (pakai nvm biar gampang ganti versi kalau perlu)
- PM2: `npm install -g pm2`
- Nginx: `apt install nginx`
- Certbot (buat SSL gratis): `apt install certbot python3-certbot-nginx`

## 3. Deploy kode ke server

Opsi paling simpel buat awal (nggak perlu CI/CD dulu):

1. Push project ke GitHub (kalau belum).
2. `git clone` repo di VPS.
3. `npm install` di folder backend & frontend.
4. Build frontend: `npm run build` (hasil ke folder `dist`).
5. Set environment variables backend (`.env` di server — connection string NeonDB, JWT/session secret, dll). **Jangan commit `.env` ke git.**

Update berikutnya cukup: `git pull` → `npm install` (kalau ada dependency baru) → `npm run build` (kalau ada perubahan FE) → `pm2 restart <app-name>`.

## 4. Jalankan backend dengan PM2

```
pm2 start npm --name "taralaya-backend" -- run start
pm2 save
pm2 startup
```

`pm2 startup` bikin PM2 otomatis jalan lagi kalau VPS-nya restart/reboot. `pm2 save` nyimpen daftar app yang lagi jalan biar ke-restore.

Berguna buat monitoring:

- `pm2 logs taralaya-backend` — liat log realtime
- `pm2 status` — cek app masih hidup atau nggak
- `pm2 restart taralaya-backend` — restart manual setelah deploy baru

## 5. Nginx sebagai reverse proxy

Nginx yang nerima request dari internet (port 80/443), terus:

- Request ke `/api/*` diteruskan ke backend Express yang jalan di port lokal (misal `localhost:3000`)
- Request lainnya di-serve langsung dari folder `dist` hasil build frontend (static files)

Contoh config dasar (`/etc/nginx/sites-available/taralaya`):

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    root /path/to/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        try_files $uri /index.html;
    }
}
```

Aktifkan: `ln -s /etc/nginx/sites-available/taralaya /etc/nginx/sites-enabled/` lalu `nginx -t` (test config) dan `systemctl reload nginx`.

## 6. Domain & SSL

1. Beli domain (provider bebas).
2. Di dashboard registrar domain, arahkan **A record** ke IP address VPS.
3. Tunggu propagasi DNS (biasanya beberapa menit — beberapa jam).
4. Jalankan Certbot buat SSL gratis: `certbot --nginx -d yourdomain.com` — otomatis setup HTTPS + auto-renewal.

## 7. Koneksi ke NeonDB

Nggak ada perubahan dari sisi DB — tetap pakai connection string NeonDB di `.env` backend, sama seperti waktu development lokal. Drizzle config nggak perlu diubah (beda dengan skenario Vercel yang butuh serverless driver khusus) — driver Postgres biasa aman dipakai di server yang long-running kayak VPS.

## 8. Checklist sebelum go-live

- [ ] `.env` production ke-set dengan benar di VPS (bukan copy dari lokal yang mungkin masih pakai kredensial dev)
- [ ] PM2 udah di-set `pm2 startup` biar auto-hidup lagi kalau server reboot
- [ ] Login super admin dicoba di domain production
- [ ] Generate quotation & invoice PDF di production, pastiin lancar
- [ ] Nginx udah proxy `/api` dengan benar, cek dari browser devtools nggak ada request gagal
- [ ] SSL aktif (https, bukan http)
- [ ] Firewall VPS cuma buka port yang perlu (22, 80, 443)

---

## Catatan

Kalau ke depannya mau lebih otomatis (nggak perlu SSH manual tiap update), bisa nambahin GitHub Actions buat auto-deploy pas push ke branch tertentu — tapi ini optional, nggak wajib buat V1.

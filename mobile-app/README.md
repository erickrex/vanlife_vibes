# VanlifeVibes Mobile (React Native)

This folder contains the React Native mobile app. The existing web app stays in `frontend/`.

## Quick start

```bash
cd mobile-app
npm install
cp .env.example .env
npm run start
```

## API base URL

Edit `mobile-app/.env`:

- iOS Simulator: `EXPO_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1`
- Android Emulator: `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000/api/v1`
- Physical device: use your machine LAN IP (e.g. `http://192.168.1.50:8000/api/v1`)


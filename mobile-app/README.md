# VanlifeVibes Mobile (React Native)

This folder contains the React Native mobile app for VanlifeVibes.

## Target platform

This mobile app currently targets **Android only** (Expo Go for local dev and EAS Build for APK/AAB builds).

## Quick start

```bash
uv run python manage.py runserver 0.0.0.0:8000

cd mobile-app
npm install
cp .env.example .env
npm run start
```

## EAS / expo.dev (cloud builds)

This project is configured with:

- Android package: `com.erickrhein.vanlifevibes`

To create a cloud build you can install on your Android phone:

```bash
cd mobile-app
npm i -g eas-cli
eas login
eas init
eas build -p android --profile preview
```

## API base URL

Edit `mobile-app/.env`:

- iOS Simulator: `EXPO_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1`
- Android Emulator: `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000/api/v1`
- Physical device: use your machine LAN IP (e.g. `http://192.168.1.50:8000/api/v1`)
- Optional websocket override: `EXPO_PUBLIC_WS_BASE_URL=ws://192.168.1.50:8000` (do not add `/ws` to this value)
- For physical devices, backend must run with `uv run python manage.py runserver 0.0.0.0:8000`
- After changing `.env`, restart Expo with cache clear: `npx expo start -c`

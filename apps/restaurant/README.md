# Datuk Yap Fish Poud Restaurant

Standalone, offline-first restaurant ordering kiosk for a 27-inch touchscreen. It has no data connection to Yun Fook POS; the two apps only share `@yf/ui` design tokens and touch components.

## Development

From the monorepo root:

```sh
pnpm dev:restaurant
```

The browser development build persists to local storage. The packaged Electron app persists independently to `datuk-yap-restaurant.sqlite` in Electron's application data directory.

## Build

```sh
pnpm build:restaurant
pnpm dist:restaurant:win
```

The Windows installer and portable executable are written to `apps/restaurant/release`.

Receipt printing and customer credit are intentionally outside the v0 scope.

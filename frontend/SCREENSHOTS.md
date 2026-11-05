# Screenshot scenes

Run `npm run dev:screenshots` from this frontend directory. No backend is needed.

- http://127.0.0.1:8082/?screenshot=landing → landing.webp
- http://127.0.0.1:8082/?screenshot=landing-mobile → landing-mobile.webp
- http://127.0.0.1:8082/?screenshot=gameplay → cover.webp
- http://127.0.0.1:8082/?screenshot=lobby → lobby.webp
- http://127.0.0.1:8082/?screenshot=results → results.webp
- http://127.0.0.1:8082/?screenshot=mobile-gameplay → mobile-gameplay.webp

Wait for `#root[data-screenshot-ready="true"]` before capture. Readiness waits for image decoding, fonts, and layout frames; asset failures leave it unset. Unknown scenes show an error and never become ready. Use 1600×900 desktop and 390×844 for landing-mobile and mobile-gameplay.

Both landing scenes reuse `LandingScreen` with the same fixed player name and connected (Online) presentation status. They do not mount the normal application's health checks or multiplayer connections. Form submissions are inert and prevent browser navigation.

Only Vite development with `--mode screenshots` enables selection. Ordinary development and all production builds ignore the query. The dynamic demo import is eliminated from production bundles, even with `vite build --mode screenshots`. Fixtures render production components without mounting the application session/socket hooks. Controls are inert, timers are fixed, animations are disabled, and no demo state is saved. Do not publish a development server.

The Cards selector can preview Traditional in gameplay scenes. It starts in Modern and never reads or writes the real preference in screenshot mode. The selector is the only live presentation control; game actions remain inert. Licensed artwork credits are available beside the selector and at the landing page edge.

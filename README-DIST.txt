DOTA DRAFT ASSISTANT 2.0
=======================

A local browser app for Dota 2 drafting. It runs entirely on this computer.

WINDOWS
-------
Double-click DotaDraftAssistant.exe. The browser opens automatically.
No console window is created. To stop the app, use the red "Завершить /
Terminate" button in the top-right corner.

If SmartScreen appears, choose "More info" -> "Run anyway" (the binary is
not code-signed).

LINUX
-----
Run:      ./start.sh
Install:  ./install-desktop.sh   (adds the app to the application menu)
Stop:     red "Завершить / Terminate" button in the browser.

start.sh launches the server in the background, so it does not occupy the
terminal. If the browser does not open automatically, read the URL from:
  ~/.config/DotaDraft/session.json

DEFAULT URL
-----------
http://127.0.0.1:27890/

The server is bound to 127.0.0.1 only. Draft state is stored in the browser;
refreshed data is cached in the user config directory (DotaDraft/data).

DATA
----
Bundled snapshot: OpenDota public matches + Valve/Steam hero portraits.
Refresh: Settings -> "Обновить из OpenDota" (3-4 minutes, network required).
Dotabuff and Stratz are linked for guides/hero pages; they do not provide an
open API used by this app.

The project and sources: github.com/wthxtzy/Dotabuff-guides-and-counters

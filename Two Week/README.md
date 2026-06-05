# Two Weeks

Two Weeks is an original low-poly online multiplayer browser battle royale prototype. Players join rooms, wait in a lobby, launch from Spawn Island, ride the battle bus over the arena, loot weapons, build cover, fight through a shrinking storm, and try to be the last player standing.

This project is designed for online hosting. The intended setup is:

- Push this project to GitHub.
- Deploy the GitHub repository to Railway.
- Railway runs `npm start`.
- `server.js` serves both the browser client and the Socket.IO multiplayer server from the same hosted origin.
- The browser client connects with same-origin Socket.IO using `io()` in `public/src/network.js`.

Local development is only for testing while editing.

## Features

- Node.js, Express, and Socket.IO multiplayer server.
- Single server for static hosting and real-time game traffic.
- Server listens on `process.env.PORT || 3000`.
- Browser client uses HTML, CSS, JavaScript, Three.js, DOM UI, and Web Audio.
- No bundler, React, Vue, Angular, Next.js, Vite, Phaser, Unity, or Unreal.
- Quick Match, Private Room, Practice Mode, and Sandbox Build Test.
- Bot Lobby for solo play when no other players are online.
- Online rooms with lobby, host start, countdown, match, results, and cleanup.
- Third-person movement, jumping, sprinting, server movement clamping, and remote player interpolation.
- Spawn Island and battle bus opening for real matches.
- Optional custom map model support at `public/assets/models/map.glb`, with a generated low-poly fallback map if no model is provided.
- Live minimap plus an openable full island map with storm, players, floor loot, chests, and ammo boxes.
- Health, shield, eliminations, spectators, kill feed, and last player standing.
- Four weapon archetypes: Pistol, Assault Rifle, Scatter Shotgun, and Longview Rifle.
- Floor loot, chests, and ammo boxes with server-authoritative rewards.
- Building pieces: wall, ramp, floor, and roof/cone with server validation, material cost, health, syncing, and shot blocking.
- Server-controlled shrinking storm.
- Settings for volume, mouse sensitivity, invert Y, graphics quality, FPS, ping, fullscreen, and reduced motion.

## File Structure

```text
package.json
server.js
README.md
.gitignore

public/index.html
public/style.css
public/src/main.js
public/src/game.js
public/src/player.js
public/src/input.js
public/src/network.js
public/src/world.js
public/src/building.js
public/src/weapons.js
public/src/loot.js
public/src/storm.js
public/src/ui.js
public/src/audio.js
public/src/settings.js
public/src/utils.js
public/src/camera.js
public/src/effects.js

server/gameServer.js
server/rooms.js
server/playerState.js
server/projectiles.js
server/collision.js
server/lootServer.js
server/stormServer.js
server/buildingServer.js
server/utils.js

public/assets/img/
public/assets/audio/
public/assets/models/
```

The asset folders can stay empty. The game works with generated Three.js shapes and generated Web Audio.

## Local Development Test

Use this only while developing:

```bash
npm install
npm start
```

Then open:

```text
http://localhost:3000
```

To test multiplayer locally, open two browser tabs, create a Private Room in the first tab, copy the room code, join from the second tab, and start the match from the host tab.

The production client does not hardcode that local URL. It connects to whichever origin served the page.

## GitHub Setup

1. Create a new empty repository on GitHub.
2. In this project folder, initialize Git if needed:

```bash
git init
git add .
git commit -m "Initial Two Weeks prototype"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

3. Keep `node_modules/` out of Git. It is already ignored by `.gitignore`.

## Railway Deployment

1. Log in to Railway.
2. Create a new project from your GitHub repository.
3. Select this repository.
4. Railway should detect Node.js from `package.json`.
5. Use the default install step.
6. Make sure the start command is:

```bash
npm start
```

7. Railway automatically provides a `PORT` environment variable. `server.js` uses:

```js
process.env.PORT || 3000
```

8. Open the Railway-generated public URL. Players can share that URL and join from different computers.

Do not add a fixed Railway URL to the client. `public/src/network.js` uses:

```js
const socket = io();
```

That connects to the same hosted origin that served the page.

## How Rooms Work

- Quick Match joins an available public room or creates one.
- Private Room creates a six-character room code. The host can start with one player for testing.
- Bot Lobby creates a server-backed solo battle royale with AI opponents.
- Practice Mode creates a server-backed solo room with target dummies.
- Sandbox Build Test creates a server-backed solo room with unlimited materials.
- Empty rooms are cleaned up by the server.
- Matches support up to 16 players by default.

## Controls

- WASD: move
- Mouse: look and aim
- Space: jump
- Shift: sprint
- E: pick up loot
- G: use selected healing or shield item
- R: reload, or rotate build while in build mode
- Left click: shoot or place build
- Right click: cancel build mode
- Q: toggle build mode
- Z: wall
- X: ramp
- C: floor
- V: roof/cone
- 1-5: inventory slots
- M: open island map
- Esc: pause pointer lock

## Custom Map Model

When you provide a map model, put it here:

```text
public/assets/models/map.glb
```

`public/src/world.js` checks for that file and loads it with Three.js `GLTFLoader`. If the file is missing, the generated low-poly arena remains available. The included map is scaled into the 320-unit server arena so players, storm, loot, chests, ammo boxes, Spawn Island, and the battle bus share one coordinate space.

The included `map.glb` has been optimized to stay below GitHub's 25 MB web-upload limit. If you replace it with a higher-detail model later, keep the file below your hosting and repository limits or use Git LFS.

## Tuning The Prototype

Change max players:

- Edit `MAX_PLAYERS` in `server/utils.js`, or set `TWO_WEEKS_MAX_PLAYERS` in the server environment.

Change Quick Match auto-start player count:

- Edit `QUICK_START_PLAYERS` in `server/utils.js`, or set `TWO_WEEKS_QUICK_START_PLAYERS`.

Change Bot Lobby opponent count:

- Edit `BOT_LOBBY_BOT_COUNT` in `server/utils.js`, or set `TWO_WEEKS_BOT_COUNT`.

Change weapon stats:

- Server authority: `server/utils.js`, `WEAPON_STATS`.
- Client labels/colors: `public/src/weapons.js`.

Change building cost and health:

- Edit `BUILD_COST` and `BUILD_HEALTH` in `server/buildingServer.js`.

Change storm settings:

- Edit `STORM_PHASES` in `server/stormServer.js`.

Change loot:

- Edit `LOOT_TABLE` and `NAMED_LOOT_POINTS` in `server/lootServer.js`.

## Known Limitations

- This is a first playable prototype, not a 100-player production-scale battle royale.
- Server validation rejects obvious impossible actions, but this is not a complete anti-cheat system.
- Movement prediction is light; remote players are interpolated, but high latency can still show corrections.
- Build collision is intentionally simple.
- The optional map model is loaded at runtime and should be kept lightweight for browser performance.
- Bot Lobby bots are simple server-controlled opponents. They move, aim, shoot, take storm damage, and count toward last-player-standing, but they do not yet loot intelligently or build.
- There is no account system, matchmaking ranking, team mode, or persistent progression.

## Future Improvements

- Add proper gliding and manual bus drop timing.
- Add full spectator camera cycling.
- Add harvesting for trees, rocks, and crates.
- Add supply crates.
- Add build editing.
- Add stronger client prediction and reconciliation.
- Improve Bot Lobby with smarter looting, pathing, and defensive building.
- Add team modes and revive cards.
- Add cosmetics and color selection.
- Optimize large custom map models with compression and LODs.

## Deployment Checklist

- `npm start` runs `node server.js`.
- Railway supplies `PORT`; no manual port change is needed.
- Express serves the `public/` folder.
- Socket.IO is attached to the same HTTP server.
- Client networking uses `io()` with no hardcoded server URL.
- No fixed local or Railway URL is required in production code.

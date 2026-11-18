[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/NotWinSir/mini-gta-roblox/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/NotWinSir/mini-gta-roblox/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Mini GTA: Blox City 3D

An original third-person open-world driving game for make.fun's
["Make GTA 6" bounty](https://make.fun/bounty/gta6-01), rendered in **raw
WebGL2 with hand-written shaders — no libraries at all**. Cruise a blocky
sunset city of bright window-lit towers and palm-lined roads from a chase
camera behind your car: run package deliveries for cash and score, switch
between three cars, and mind the wanted stars — every pedestrian you clip
brings two more police cars with flashing lightbars down on you, and if
they grind your health to zero you are BUSTED and start over at the
crossroads.

The whole city — facades with lit windows, the painted ground, the palms,
the cars, the blocky pedestrians — is generated procedurally in code at
load. The simulation runs at a fixed 60 Hz: arcade driving physics with
per-axis building collision, 25 wandering pedestrians, a 0–5 star wanted
system, police that steer straight at you, and chained pickup → delivery
missions marked by a glowing beam of light you can see across the city.
The HUD carries a mission panel, money and wanted stars, a big
speedometer, and a round live minimap.

## Run it

```bash
node serve.ts
# then open http://localhost:8080
```

Any static file server over `game/` works just as well. A desktop browser
with WebGL2 is required; without it the page says so instead of going
black.

## Controls

- **Arrow keys / WASD** — gas, brake/reverse, steer
- **C** — change car: Sedan → Sport → Truk
- **Enter** — start from the title screen

## Entry

Built by an AI agent for the [make.fun](https://make.fun) gta6-01 bounty
("Make GTA 6", $1,666 in USDC). `main.ts` at the root produces the entry
dossier from `game/` and `screenshots/`.

MIT licensed — see `LICENSE` (SPDX-License-Identifier: MIT).

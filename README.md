# Neon Harbor

An original open-world crime game set in **Port Meridian**, a sun-soaked harbour city. You are **Rae Calloway**, a courier with a stolen past, working jobs for fixer **Marisol Vega** while the Meridian PD — led by Sgt. Ilya Brandt — watches the streets.

## Play

- **Explore on foot, by car and by motorcycle** — seven districts (Downtown, Old Town, Marina, Foundry Row, Harbor Lights, Dockside container yards, Sandside beach), traffic that follows the street grid, pedestrians who stroll and flee, and hi-vis dockworkers in Dockside.
- **Steal and drive** — walk up to any car or bike and press **E**. Parked vehicles are free; jacking one with a driver, or lifting a police cruiser, brings heat. The **Harbor Hawk** motorcycle is quicker off the line than any car and threads gaps a car cannot — but it is fragile, and a hard wall hit hurts.
- **Wanted level** — 0–5 stars. Cops chase on foot and in cruisers, ram your vehicle, and bust you if they get close. At four stars the PD sends out motorcycle interceptors that cut corners the cruisers cannot. Stay out of sight and the heat fades.
- **Six story missions** — First Fare, Hot Wheels, Street Heat, The Drop, Harbor Heist, and the finale, The Tide Turns, in which Dario Kess himself — three times the health of his crew, and a straighter shot — waits among the Dockside containers. Plus repeatable courier jobs and cash/health/ammo pickups.
- **Combat** — mouse aim, click to shoot, on-foot shootouts with the Tide gang. Rae carries a **pistol** from the start; finishing Street Heat earns the **scattergun** (five pellets, close range, keys **1** / **2** to switch).
- **HUD + minimap** — cash, reputation, health, wanted stars, the current weapon, mission objective, speed, and a live circular minimap with waypoint, cops and the player arrow.
- **Day/night cycle, save/load** — a full day runs 4 minutes; progress autosaves after every mission and can be saved from the pause menu (localStorage).
- **Sound** — fully synthesised WebAudio: engine hum (higher and raspier on a bike), sirens, gunshots, the scattergun's boom, pickups, mission jingles, a boss sting and a synthwave bassline. No audio files. **M** mutes.

## Controls

WASD move / drive · E enter or steal a vehicle · Mouse aim, Click shoot · 1 / 2 switch weapons · Shift sprint · Space handbrake · Esc pause & save · M mute

## Run it

Serve `game/` with any static server and open `index.html` in desktop Chrome. For local testing: `node serve.ts` then http://localhost:8080.

Screenshots are staged with `?shot=start|drive|chase|mission` (deterministic renders of the game itself). `?selftest=1` runs the in-game self-test (31 checks: city, bikes, weapons, missions, boss, save/load, render).

## Originality

Everything — the city, characters, vehicles, story, art and music — is original fiction made for this game. Nothing from any commercial game appears in it.

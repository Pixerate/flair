---
"@pixerate/flair": minor
---

Three new categories of effects, browsed under Pictures:

- `emergency`: `siren-lights` (the red and blue wash of a light bar, alternating or rotating, as an overlay), `red-alert` (a picture or video under red emergency lighting with a beacon sweeping round), `caution-tape` (tape snapping across the frame in an X, any text) and `emergency-alert` (a phone's emergency alert card dropping in and buzzing). Neither light can be set to light up more than one and a half times a second; the shaders clamp it too.
- `film`: `film-strip` (a picture or video running through a strip of film between its sprocket holes, upright, across or tilted, as a negative too), `film-damage` (a battered print: scratches, dust, hair, blotches, splices and cue marks), `dramatic-letterbox` (bars slamming in with a push-in and a teal-and-orange grade) and `film-projector` (a vintage projector running, as an animated SVG). `letterbox`, `academy-leader` and `cinema-projector` move here from `cinematic`, keeping their `cinematic` tag.
- `crt`: `crt-power` (a tube switching on from a bright line and off to a fading dot), `vertical-roll` (a picture rolling as it loses vertical hold, then catching), `crt-television` (a picture on an old TV set in a dark room) and `crt-terminal` (a phosphor terminal typing out lines, as an animated SVG). `crt` moves here from `image` and `tv-static` from `retro`.

Filter by `category: "emergency"`, `"film"` or `"crt"` to find them. The Swift package gains the new shaders.

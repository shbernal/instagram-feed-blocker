# Icon explorations

This file keeps the icon directions that were tried and not shipped, so a later
round starts from what was already learned instead of rediscovering it. Only the
shipped mark lives in `store/logo.svg`; everything here is history.

The images in `icon-explorations/` are reference renders, not build inputs.
`pnpm icons` renders every shipped asset from `store/logo.svg` alone.

Every sketch uses the same tile: a 768-unit rounded square centred in a
1024-unit canvas, with the mark in near-white `#F0FDFA`. Rounds 1 to 3 fill the
tile with teal `#0F766E`, about 4.9:1 in luminance against the mark; round 4
fills it with a gradient. Each image shows the mark at 128px next to its 16px render
enlarged eight times with nearest-neighbour scaling, so each device pixel is
visible. 16px is the size the extensions page uses, and the one that decides.

## Round 1, September 2026

| #   | Concept                                        | Sketch                                                         | Verdict                                                                                     |
| --- | ---------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | Lowered blind: three bars and a pull cord      | [1-lowered-blind.png](./icon-explorations/1-lowered-blind.png) | Rejected. Bars fall between device pixels at 16px, and three equal bars read as a menu icon |
| 2   | Horizon: a half sun resting on a line          | [2-horizon.png](./icon-explorations/2-horizon.png)             | Rejected. Holds its shape at 16px, but at 32 and 48 it reads as a hat or a service bell     |
| 3   | Closed eye: a lid arc with lashes              | [3-closed-eye.png](./icon-explorations/3-closed-eye.png)       | Rejected. The lashes turn to noise at 16px                                                  |
| 4   | Paused post: a card outline with pause bars    | [4-paused-post.png](./icon-explorations/4-paused-post.png)     | Rejected. A rounded-square outline is the body of Instagram's own glyph                     |
| 5   | Lowered shade: a card outline, shade half down | [5-lowered-shade.png](./icon-explorations/5-lowered-shade.png) | Rejected for the same outline, and its inner detail fuses into a grey block at 16px         |

What the round established:

- **No outline inside the tile.** A rounded square drawn in outline is what
  Instagram's camera glyph is built on, and both stores restrict listings that
  suggest affiliation with another company.
- **Edges on the pixel grid.** The tile is 12 device pixels at 16px, so 64 units
  is one pixel. A shape whose straight edges fall between pixels smears at 16px
  however simple it is.

## Round 2, September 2026

| #   | Concept                                                | Sketch                                                                   | Verdict                                                                            |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 6   | Crescent moon                                          | [6-crescent-moon.png](./icon-explorations/6-crescent-moon.png)           | Shipped from round 2 until round 4, which moved it inside a lens                   |
| 7   | Sun over horizon: a full sun above a line              | [7-sun-over-horizon.png](./icon-explorations/7-sun-over-horizon.png)     | Rejected. A disc over a bar reads as a head and shoulders, which is a profile icon |
| 8   | Half-lowered blind: a heavy top bar, two slats, a cord | [8-half-lowered-blind.png](./icon-explorations/8-half-lowered-blind.png) | Rejected. Still reads as a list or filter icon at 16px                             |

### Why the crescent

It is the Do Not Disturb sign, which is exactly what the extension is for, and a
crescent's silhouette survives 16px with nothing to lose. It still carries the
shipped mark, inside the lens round 4 drew around it.

A crescent drawn with its disc on the tile centre looks off-centre, because the
bite takes mass from the upper right. Measured on the 128px render, the filled
area's centroid sat 9px left of centre and 8px below it. Moving the disc one
device pixel up and one right, 64 units each way, brings the centroid within a
pixel of centre, and the disc's edges stay on the grid. The image above is the
shipped, centred version.

Keep the radii when touching it: on its own the disc is 256 and the bite 224,
and inside the lens they drop to 160 and 148. A thinner crescent loses its tips
at 16px.

## Round 3, September 2026

A camera pun, asked for because the extension's subject is a camera app. The
mark may not use Instagram's own camera glyph, so every sketch here draws a
filled camera body with a viewfinder bump, or drops the body and keeps the lens.

| #   | Concept                                               | Sketch                                                               | Verdict                                                                                           |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 9   | Lens cap on: a camera with a cap bar across the lens  | [9-lens-cap.png](./icon-explorations/9-lens-cap.png)                 | Rejected on the colour round, not on legibility. The only camera sketch whose joke survives 16px  |
| 10  | Dozing lens: a lens as a shut eye, with a z           | [10-dozing-lens.png](./icon-explorations/10-dozing-lens.png)         | Rejected. The z softens at 16px and the mark reads as a smiley                                    |
| 11  | Camera, eye shut: a camera whose lens is a closed eye | [11-sleeping-camera.png](./icon-explorations/11-sleeping-camera.png) | Rejected. At 16px the eye fills in and a plain camera is left, so the joke only lands large       |
| 12  | Shutter shut: aperture blades closed over the opening | [12-shutter-shut.png](./icon-explorations/12-shutter-shut.png)       | Rejected. Six blades cannot resolve across twelve device pixels                                   |
| 13  | Lowered lid: an eyelid drawn down over the lens       | [13-lowered-lid.png](./icon-explorations/13-lowered-lid.png)         | Rejected. A white lid against a white body has no edge between them, so it reads as an open mouth |
| 14  | Lens and moon: a lens barrel around the crescent      | [14-lens-and-moon.png](./icon-explorations/14-lens-and-moon.png)     | Chosen, then recoloured in round 4. At this size the moon inside the ring smeared                 |

What the round established:

- **One interior detail, or none.** A camera body fills most of the tile, which
  leaves about four device pixels for whatever sits in the lens. One bold shape
  survives there; an eye, a z or six blades do not.
- **A white shape needs a dark edge.** Two near-white shapes that touch merge
  into one silhouette at every size, which is what sank the lowered lid.

## Round 4, September 2026

Colour, and the fix that made the lens and moon hold at 16px: the ring is one
device pixel thick with its edges on 256 and 320, and the moon shrank to `r=160`
so a full pixel of ground separates the two.

| #   | Concept                                           | Sketch                                                       | Verdict                                                                                        |
| --- | ------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 15  | Instagram's ramp, as published                    | [15-ramp.png](./icon-explorations/15-ramp.png)               | **Shipped**, as `store/logo.svg`                                                               |
| 16  | The same ramp with its palest yellow stop dropped | [16-deeper-ramp.png](./icon-explorations/16-deeper-ramp.png) | Not shipped. Holds white better than the real ramp, while still reading as Instagram's colours |
| 17  | Dusk: the project's teal into violet and magenta  | [17-dusk.png](./icon-explorations/17-dusk.png)               | Kept as `store/logo-dusk.svg`, the standby if a store objects to the ramp                      |

### What the ramp costs

The shipped tile wears Instagram's published gradient, and a circle centred on a
rounded square is how their own glyph is built. Both stores reject branding that
implies a tie to another company, and Meta's guidelines put the gradient outside
permitted use. That risk was weighed and accepted; the standby exists so the
answer to a rejection is one edit rather than a new round.

The ramp's palest stop, `#FEDA75`, is the weak point: near-white on it is about
1.6:1, so the lower-left arc of the ring is the first thing to fade when the
icon is scaled down or shown on a light page. Sketch 16 is the drawn fix, and
sketch 17 avoids the problem outright.

# Icon explorations

This file keeps the icon directions that were tried and not shipped, so a later
round starts from what was already learned instead of rediscovering it. Only the
shipped mark lives in `store/logo.svg`; everything here is history.

The images in `icon-explorations/` are reference renders, not build inputs.
`pnpm icons` renders every shipped asset from `store/logo.svg` alone.

Every sketch used the same tile: a 768-unit rounded square centred in a
1024-unit canvas, teal `#0F766E`, with the mark in near-white `#F0FDFA`, about
4.9:1 in luminance. Each image shows the mark at 128px next to its 16px render
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
| 6   | Crescent moon                                          | [6-crescent-moon.png](./icon-explorations/6-crescent-moon.png)           | **Shipped**, after centring                                                        |
| 7   | Sun over horizon: a full sun above a line              | [7-sun-over-horizon.png](./icon-explorations/7-sun-over-horizon.png)     | Rejected. A disc over a bar reads as a head and shoulders, which is a profile icon |
| 8   | Half-lowered blind: a heavy top bar, two slats, a cord | [8-half-lowered-blind.png](./icon-explorations/8-half-lowered-blind.png) | Rejected. Still reads as a list or filter icon at 16px                             |

### Why the crescent

It is the Do Not Disturb sign, which is exactly what the extension is for, and a
crescent's silhouette survives 16px with nothing to lose.

A crescent drawn with its disc on the tile centre looks off-centre, because the
bite takes mass from the upper right. Measured on the 128px render, the filled
area's centroid sat 9px left of centre and 8px below it. Moving the disc one
device pixel up and one right, 64 units each way, brings the centroid within a
pixel of centre, and the disc's edges stay on the grid. The image above is the
shipped, centred version.

Keep the radii when touching it: the disc at 256 and the bite at 224. A thinner
crescent loses its tips at 16px.

# Platform notes — working within Twenty's front-component sandbox

Twenty app **front-components** (`src/front-components/*`) don't run in the page. They execute as
untrusted code in a **Web Worker** and describe their UI through **Remote DOM**: the worker sends a
virtual element tree, and Twenty's host mirrors it to real DOM, applying a *curated* set of
attributes and forwarding a *curated* set of events back to the worker.

That isolation is good for security, but it means a few browser features aren't available. Below is
what we hit while building the report builder, how we verified it, and how we worked within it — so
the builder stays a **portable Twenty app** that runs on any vanilla Twenty instance.

## Constraints found (verified) and our workarounds

| Constraint (verified via Playwright / testing) | Workaround in this app |
| --- | --- |
| **Native HTML5 drag (`draggable` attr + `dragstart`/`dragover`/`drop`) is not forwarded** — only the bare `drag` event is mapped, and `draggable` isn't in the host's property schema. | We don't use HTML5 drag. Reorder is a **pointer-based drag** instead (next row), which needs none of it. |
| **Pointer events DO forward, with coordinates.** Verified against Twenty core v2.15.0 (`packages/twenty-front-component-renderer`): `pointerdown/pointermove/pointerup/pointerenter/pointerleave` (and `mousedown/move/up`) are registered on every element, and the host serializes `clientX/clientY/pageX/pageY/offsetX/offsetY/movementX/Y/pointerId/button` back to the worker. | **Real drag-and-drop reorder:** grab a block by its **⠿** handle (`onPointerDown`), the list reflows live as the pointer moves over other blocks (each block's `onPointerEnter` sets the insertion index), and it drops on `pointerup`. A floating ghost follows the cursor via the forwarded `clientX/clientY`. No click-to-place, no ↑/↓. |
| **DOM measurement is still unavailable** (`getBoundingClientRect` on the worker's proxy elements is not meaningful), so a measurement-based DnD **library can't work** (`dnd-kit`, `framer-motion` drag). | The pointer-drag deliberately avoids measurement: drop targets come from per-block `onPointerEnter` + a drag-direction heuristic, not geometry. |
| **CSS keyframe animations are stripped.** | Motion (the assistant "thinking…" dots, the loading-skeleton pulse) is driven by **JS timers** (`setInterval`) updating inline styles/text. |
| **`event.stopPropagation()` is unreliable** across the worker boundary — a child handler can't stop an ancestor handler. | No competing "click-away" handlers on ancestors; selection is changed with explicit controls (a block click / a **Deselect** button). |
| **First paint is blank for a moment.** Under network throttling the whole page's `body` stays empty for several seconds. | That blank is **Twenty's own SPA app-boot** (loading the host shell), which runs *before* our component mounts — no in-app code can fill it. Our **skeleton** covers the phase we *do* control: our component mounted, its data still fetching (near-instant on a local server, visible on slower/cloud connections). |

## Why pointer-drag, not native HTML5 drag

Native HTML5 drag would require a change in **Twenty core** (the host-side Remote DOM receiver):
whitelist the `draggable` attribute and forward `dragstart` / `dragover` / `drop`. We avoid that on
purpose — it would fork core and make the app non-portable.

It turns out we don't need it. Twenty core already forwards **pointer events with coordinates** (see
the table above), so the builder implements a genuine drag-and-drop with `pointerdown` →
`pointermove` (live ghost + reflow) → `pointerup`, using only what the stock sandbox exposes. This
runs on **any vanilla Twenty** — no core patch, no forked image.

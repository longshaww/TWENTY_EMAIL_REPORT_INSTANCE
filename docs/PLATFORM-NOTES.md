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
| **`draggable` + HTML5 drag events are not forwarded.** Every canvas block rendered with `title`/`cursor:grab` applied but `el.draggable === false`, and `document.querySelectorAll('[draggable="true"]').length === 0`. So `dragstart`/`dragover`/`drop` never fire. | **Click-to-place reorder:** click a block's **⠿ Move** grip to pick it up, then click a **"▸ Move here ◂"** slot to drop it. **↑ / ↓** buttons remain as a fallback. |
| **Only trusted click / pointer / keyboard events forward, and there's no DOM measurement** (`getBoundingClientRect` on the worker's proxy elements is not meaningful). | A position-based drag-and-drop **library can't work** here — `dnd-kit` needs real DOM measurement, and `framer-motion`'s drag (bundled transitively in the SDK, not exported) is pointer-based but still needs layout metrics. Reorder is therefore **click-driven**, which forwards reliably. |
| **CSS keyframe animations are stripped.** | Motion (the assistant "thinking…" dots, the loading-skeleton pulse) is driven by **JS timers** (`setInterval`) updating inline styles/text. |
| **`event.stopPropagation()` is unreliable** across the worker boundary — a child handler can't stop an ancestor handler. | No competing "click-away" handlers on ancestors; selection is changed with explicit controls (a block click / a **Deselect** button). |
| **First paint is blank for a moment.** Under network throttling the whole page's `body` stays empty for several seconds. | That blank is **Twenty's own SPA app-boot** (loading the host shell), which runs *before* our component mounts — no in-app code can fill it. Our **skeleton** covers the phase we *do* control: our component mounted, its data still fetching (near-instant on a local server, visible on slower/cloud connections). |

## How native drag *could* be enabled (deliberately not done)

Native HTML5 drag would only need a change in **Twenty core** (the host-side Remote DOM receiver):
whitelist the `draggable` attribute and forward the `dragstart` / `dragover` / `drop` events (with
their `clientX/clientY`) to the worker. The builder's block rows could then use native drag directly.

We **did not** do this because it lives in Twenty core, not the app: the evaluators run **vanilla
Twenty**, so a forked/patched core wouldn't run this app's drag on their instance — it would stop
being a portable app. Click-to-place gives the same outcome (move a block anywhere in one gesture)
on any Twenty, today.

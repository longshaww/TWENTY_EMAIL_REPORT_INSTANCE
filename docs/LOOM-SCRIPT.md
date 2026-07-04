# Loom demo script (~4 minutes)

**Goal:** show a non-technical person going from a sentence to a scheduled,
good-looking email report — and prove the numbers are trustworthy.

---

### 0 · Setup (before recording)
- Local Twenty running, app synced (`yarn twenty dev`), NorthPeak data seeded.
- `OPENROUTER_API_KEY` + `BREVO_API_KEY` set in the app Settings (so it runs on
  Claude and sends a real email). `PUBLIC_BASE_URL` set to the workspace URL.
- Have a test inbox open in another tab.

---

### 1 · The problem (20s)
> "Teams drown in dashboards. NorthPeak Reports lets anyone get the one number
> they care about, emailed on a schedule, just by asking for it — over our real
> Twenty CRM data."

Show the **Reports** sidebar folder and the seeded NorthPeak opportunities.

### 2 · Create from a prompt (45s)
- **⌘K → "Create report from a prompt."**
- Type: **"weekly won deals by rep and region."** Keep it Private. **Create.**
- Land in the Builder. Point at the **"Interpreted as:"** line:
  > "Claude turned my sentence into a precise, validated query — Stage is Customer,
  > grouped by Owner and Region. It never wrote a database query; it just decided
  > *what* to measure."

### 3 · Trust + AI insight (45s)
- Click **Preview**. Show the live count, "data as of" time and the **AI narrative**.
- Point at the **AI insights** block: the ▲/▼ change vs the previous 7 days and the
  one-line insight.
  > "This is where AI actually earns its place. We re-ran the *same* query over last
  > week, computed the % change **in code**, and Claude only *phrases* the deltas —
  > it can't invent a number. See the caption: *figures computed from CRM data,
  > wording by AI.*"
- Note the **"Verify in Twenty →"** idea: every email links back to the equivalent
  native view so people can check the figures themselves.

### 4 · Drag-and-drop builder (45s)
- Drag the **Chart** block above the table; nudge one with the **↑** button.
- Edit the **Header** title. Add an **AI narrative** block if not present.
- **Save layout.**

### 5 · Subscribers + schedule (30s)
- Add yourself (a workspace member) as a **Subscriber** — note it's members only.
- Set **Weekly**, send hour, **Activate.**

### 6 · Send it for real (30s)
- **Send now.** Switch to the inbox: show the delivered email — metric cards,
  QuickChart image, CSS bars, table, AI summary, verify link.
- Open **Deliveries** in the sidebar: show the audit row (status, rows, recipients).

### 7 · The AI angle + close (20s)
- Mention it's also a **native Twenty AI tool** (agents can build reports), and that
  the **model is config-driven** — running on Claude today, swappable with one env
  var, no hardcoded provider.
> "Plain language in, a trustworthy scheduled report out — and every number is
> verifiable back in Twenty."

# NorthPeak Reports — How to use it

*A guide for anyone on the team. No technical knowledge needed.*

NorthPeak Reports lets you get a good-looking report about your CRM — delivered to
your inbox on a schedule — just by **describing what you want in plain English**.

---

## 1. Create a report

1. Press **⌘K** (Mac) or **Ctrl-K** (Windows) anywhere in Twenty, or click the
   pinned **"New report"** button at the top-right.
2. Choose **"Create report from a prompt."**
3. **Pick your data source** — the thing you want to report on (Opportunities,
   Companies, People, …). This is the first choice, so the report is always built
   over the right records.
4. Then either **pick a template** for that data source, or choose **Create from
   scratch** and describe what you want, for example:
   - *"Weekly won deals by rep and region"*
   - *"Monthly won revenue by product tier"*
   - *"Open pipeline by lead source"*
5. Pick **Private** (only you) or **Workspace** (shared), then **Create report**.

The app reads your request, figures out exactly what to measure, and opens the
new report in the **Builder**.

> 💡 **How do I know it understood me?** Every report shows an
> *"Interpreted as:"* line in plain English — e.g. *"Total Amount and count of
> opportunities where Stage is Customer, grouped by Owner and Region."* If that's
> not what you meant, just tell the **✨ AI assistant** in the builder.

---

## 2. Shape the report (Builder)

The Builder is a live, what-you-see-is-what-you-get preview of the email, with:

- **Top bar** — your report name, a **Data source** picker (switch what you're
  reporting on at any time), device preview, and **Preview & test**. Changes
  **save automatically** — the bar shows "Saved ✓" (no Save button to remember).
- **Left rail — Content / Style** — drag in **blocks** (header, metric cards, chart,
  bar breakdown, table, **AI insights**, AI narrative, text, divider…) and set the
  theme (colour, font, light/dark).
- **Centre — the canvas** — your email. Click a block to select it. To reorder,
  click its **⠿ Move** grip to pick it up, then click a **"▸ Move here ◂"** slot to
  drop it (or use the ↑ ↓ buttons). Add blocks or whole sections by clicking them in
  the left rail. Every change **saves automatically**.
- **Right rail — three tabs:**
  - **✨ AI** — the **one assistant**. Tell it what you want in plain English
    (*"won revenue by rep, last 7 days"*, then *"group by region instead"*). It
    changes the data, the layout and the wording together, and asks a question if
    anything's unclear. This is the single place you "talk to" your report.
  - **Block** — fine-tune the block you clicked (e.g. rows in a table, bar vs pie).
  - **Setup** — your data source at a glance, **Preview & Send**, **Schedule** and
    **Subscribers**.

> 💡 **One assistant, not two boxes.** Everything about *what the report measures*
> and *how it looks* goes through the ✨ AI assistant — there's no separate prompt to
> keep in sync.

---

## 3. Choose who gets it

In the **Setup** tab → **Subscribers**, add the workspace members who should receive
the report. For privacy, reports can only be sent to **people in your workspace** —
never to random external email addresses.

---

## 4. Put it on a schedule

In the **Setup** tab → **Schedule**:

- **Frequency** — Manual, Daily, Weekly or Monthly.
- **Send hour** — the hour of day it goes out.
- **Activate** — turns the schedule on. From then on it sends automatically.
  (Use **Pause** to stop it without losing anything.)

---

## 5. See what changed (trends)

If your report covers a time window (e.g. *"…in the last 7 days"*), add the
**AI insights** block. It automatically compares this period with the one just
before it and shows, for each headline number, whether it went **▲ up** or
**▼ down** and by how much — plus a short, plain-English insight (e.g.
*"Won revenue is up 18%; EMEA fell 22% and dragged the total"*). The percentages
are calculated from your CRM data; only the wording is written by AI.

---

## 6. Trust the numbers

Every delivered email includes:

- the plain-English description of what was measured,
- how many records matched and the exact **"data as of"** time,
- a **"Verify in Twenty →"** link that opens the equivalent live view so you can
  check the figures yourself.

Every send is logged under **Deliveries** (in the NorthPeak Reports sidebar folder)
with the status, row count and recipients — a full history you can audit any time.

---

## FAQ

**The numbers look off.** Click *Verify in Twenty* on the report to open the live
records and compare. Adjust your prompt and re-interpret.

**Nothing was emailed.** Check you added subscribers and that the report is
**Active**. Ask an admin to confirm the email key is configured.

**Can I report on things other than deals?** Yes — mention companies, people,
tasks or notes in your prompt (e.g. *"companies by industry and region"*).

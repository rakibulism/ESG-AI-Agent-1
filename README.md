# ESG AI Agent

**ESG-Sense Live Report Session** — the primary interface for this project.

## The Page

An immersive, audit-friendly co-pilot experience where users **watch + guide + trust** the AI as it builds a complete ESG report (CSRD + GRI).

### Layout (exactly as designed)

1. **Top bar (context, no heavy controls)**
   - Company name + reporting framework + period
   - Live status (“Generating report…”)
   - Stage progress (Collecting → Cleaning → Mapping → Generating → Validating) — no crude % 
   - Elapsed time, Play/Pause, Restart, **Export audit trail**

2. **Left panel — AI activity stream** (the heart)
   - Live, human-readable system logs (not chat bubbles)
   - Every entry: short sentence + status (running/done/issue/user) + timestamp
   - Click any row to progressively reveal reasoning trace, source, confidence, duration
   - Fully exportable

3. **Center — Working canvas (dynamic & alive)**
   - Switches intelligently with the AI’s current focus:
     - Document extraction (mock PDF + live extracted fields with highlights)
     - Structuring (tables populating row-by-row in real time)
     - Narrative (report text literally types itself on screen)
     - Validation (live checklist with pass/warn)
   - Subtle motion, streaming text, and focus labels keep it feeling alive.

4. **Right panel — Human control layer**
   - **Data gaps** — surfaced automatically from the stream. CTAs: “Enter manually” / “Use estimate” / Upload
   - **AI questions** — the AI explicitly asks for guidance (“Use 2024 proxy…?”). Yes / No / Edit
   - **Suggestions** — minimal, high-signal recommendations with Apply/Dismiss

5. **Bottom command layer**
   - Natural language agent interface: “Ask ESG-Sense…”
   - Examples that work: `use last year estimate`, `skip water data`, `explain this mapping`, `upload water usage`, `pause`
   - Every command is logged as a first-class user intervention (audit-ready)

### UX Principles Applied

- Show thinking, not just results (left stream + expandable detail)
- Progressive reveal (default = clean logs; click for deep trace; “Full trace” modal for experts)
- Time matters (realistic pacing, typing animation, step transitions)
- Error ≠ failure (clear, actionable language: “Couldn’t read… Try uploading a clearer file”)
- Audit-friendly by design (every step, every user decision, every confidence score is captured and one-click exportable)

### Visual Direction

Dark neutral trust palette (zinc-950 base). Status color only (emerald / amber / sky). Subtle motion via Framer Motion. Geist + Geist Mono. Thin calm scrollbars. Paper-like canvas sections.

---

**One-line design brief (as provided):**  
Design an AI working interface where ESG-Sense actively processes data, shows its step-by-step reasoning in a live activity stream, dynamically builds reports in the center canvas, and allows users to intervene, guide, and resolve data gaps in real time.

## Getting started

```bash
npm run dev
```

Open http://localhost:3000 — the entire experience is self-contained on the home page and auto-starts a realistic demo session.

You can pause/resume, answer the AI’s questions, resolve gaps, type commands in the bottom bar, restart the whole run, and export a complete audit trail at any moment.

## Tech

- Next.js 16 + React 19 + TypeScript + Tailwind v4
- Framer Motion (subtle life)
- Sonner (toasts)
- Lucide icons
- Pure client-side simulation engine (no backend required for the demo)

All actions are reversible in the UI and fully traceable in the exported `.txt` audit file.

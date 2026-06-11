"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, Pause, RotateCcw, Download, Upload, AlertTriangle, CheckCircle2, 
  Loader2, ChevronDown, ChevronRight, MessageSquare, User, FileText, 
  Zap, ShieldCheck 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// Types
type LogStatus = 'running' | 'done' | 'issue' | 'user';

interface ActivityLog {
  id: string;
  timestamp: string;
  message: string;
  status: LogStatus;
  detail?: string;
  meta?: {
    confidence?: number;
    source?: string;
    durationMs?: number;
  };
}

interface DataGap {
  id: string;
  label: string;
  severity: 'high' | 'medium' | 'low';
  hint: string;
}

interface AIQuestion {
  id: string;
  text: string;
  context?: string;
}

interface Suggestion {
  id: string;
  text: string;
  impact?: string;
}

const STAGES = [
  "Collecting data",
  "Cleaning data", 
  "Mapping to framework",
  "Generating report",
  "Validating"
] as const;

type Stage = typeof STAGES[number];

type CanvasView = 'extraction' | 'structuring' | 'narrative' | 'validation';

const COMPANY = "Verdant Manufacturing Inc.";
const FRAMEWORK = "CSRD + GRI";
const PERIOD = "FY 2025";
const SESSION_ID = "ESG-2025-0611-7K9P";

// Demo script: timed human-readable AI steps. Each drives logs + side effects.
interface ScriptStep {
  delay: number; // ms after previous
  message: string;
  status: LogStatus;
  detail?: string;
  meta?: ActivityLog['meta'];
  advanceStageTo?: Stage;
  view?: CanvasView;
  addGap?: DataGap;
  resolveGapIds?: string[];
  addQuestion?: AIQuestion;
  resolveQuestionIds?: string[];
  addSuggestion?: Suggestion;
  streamChunk?: string; // appends to narrative when present
  focus?: string;
}

const DEMO_SCRIPT: ScriptStep[] = [
  { delay: 420, message: "Connected to QuickBooks Online (read-only)", status: "done", meta: { source: "QuickBooks", durationMs: 680 } },
  { delay: 820, message: "Extracting electricity data from utility bill (PDF)", status: "running", detail: "Invoice UT-88421 • 482,190 kWh • Scope 2 location-based", meta: { source: "Pacific Power • Feb 2025", durationMs: 1240 }, view: "extraction", focus: "Utility bill – electricity" },
  { delay: 1350, message: "Electricity data extracted: 482,190 kWh (Scope 2)", status: "done", detail: "Matched 100% to meter reading. Variance vs Jan: +3.1%.", meta: { confidence: 96, source: "Pacific Power PDF", durationMs: 890 }, advanceStageTo: "Cleaning data" },
  { delay: 680, message: "Cleaning data: normalizing units and removing duplicates", status: "running", view: "structuring", focus: "Data quality pass" },
  { delay: 920, message: "Missing water usage data for Feb–Apr", status: "issue", detail: "QuickBooks query returned null for water meter WM-03. 3 months affected.", meta: { source: "QuickBooks sync" }, addGap: { id: 'gap-water', label: "Water usage (Feb–Apr)", severity: "high", hint: "WM-03 meter offline per facilities" } },
  { delay: 780, message: "Natural gas volume normalized to therms (clean)", status: "done", meta: { confidence: 99 }, resolveGapIds: [] },
  { delay: 1100, message: "Mapping emissions to Scope 1 (stationary combustion)", status: "running", detail: "EF: EPA 2024 table 2.1 • GWP: AR6", view: "structuring", focus: "Scope 1 mapping" },
  { delay: 940, message: "Scope 1 mapped: 1,842 tCO₂e (natural gas + fleet)", status: "done", meta: { confidence: 94 }, advanceStageTo: "Mapping to framework" },
  { delay: 760, message: "Mapping Scope 2 (market + location) to E1-6", status: "running", meta: { source: "CSRD E1-6, GRI 305-2" } },
  { delay: 820, message: "Scope 2 (location) 218 tCO₂e • Scope 2 (market) 94 tCO₂e", status: "done", detail: "Used supplier-specific emission factor for green tariff portion.", meta: { confidence: 91 } },
  { delay: 650, message: "Water data gap flagged for user input (proxy available)", status: "issue", addQuestion: { id: 'q-water', text: "Use 3-month rolling average from 2024 as proxy for missing water data?", context: "2024 avg 1,240 m³/mo. Variance historically <7%." } },
  { delay: 980, message: "Mapping complete for E1 Climate change (partial)", status: "done", advanceStageTo: "Generating report", view: "narrative", focus: "E1 narrative" },
  { delay: 520, message: "Starting report narrative: Executive summary", status: "running", streamChunk: "## Executive Summary\n\nVerdant Manufacturing reduced absolute Scope 1+2 emissions 11% YoY while revenue grew 9%.", focus: "Writing executive summary" },
  { delay: 1350, message: "Writing E1-1 Gross Scope 1, 2, and 3 emissions", status: "running", streamChunk: "\n\n### E1-1: Gross Scope 1, 2 and 3 GHG emissions\n\nScope 1: 1,842 tCO₂e\nScope 2 (location-based): 218 tCO₂e\nScope 2 (market-based): 94 tCO₂e\nScope 3 (screened): 14,920 tCO₂e (Category 1 dominant)", view: "narrative" },
  { delay: 920, message: "Cross-referencing water intensity against GRI 303-3", status: "running", view: "validation", focus: "Validation checks" },
  { delay: 1050, message: "Could not read one supplier PDF (scanned, low contrast)", status: "issue", detail: "Supplier: Tier-1 packaging. Recommend re-upload or manual keying of 3 fields.", meta: { source: "Acme Packaging Q4 invoice" }, addGap: { id: 'gap-packaging', label: "Packaging supplier emissions (Q4)", severity: "medium", hint: "Scanned PDF – OCR failed" } },
  { delay: 780, message: "Report sections E1 + E2 populated. Awaiting water resolution.", status: "done", advanceStageTo: "Validating", view: "validation" },
  { delay: 640, message: "Validating: Scope 1+2 total reconciles with 2024 CDP filing (±2.4%)", status: "done", meta: { confidence: 100 } },
  { delay: 880, message: "Validating: All material Scope 3 categories screened per E1-6", status: "running" },
];

// Main component
export default function ESGSenseLive() {
  // Core state
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [currentStage, setCurrentStage] = useState<Stage>("Collecting data");
  const [currentView, setCurrentView] = useState<CanvasView>("extraction");
  const [currentFocus, setCurrentFocus] = useState<string>("Initializing session...");
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0); // seconds
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  // Human control state
  const [gaps, setGaps] = useState<DataGap[]>([
    { id: 'gap-water', label: "Water usage (Feb–Apr)", severity: 'high', hint: "WM-03 meter offline per facilities" },
  ]);
  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([
    { id: 'sug-1', text: "Apply 2024 water intensity proxy for Q1 gap (error <7% historically)", impact: "Closes high-severity gap" },
  ]);

  // Center canvas dynamic state
  const [streamedNarrative, setStreamedNarrative] = useState("");
  const [extractedFields, setExtractedFields] = useState<Array<{ label: string; value: string; unit?: string }>>([
    { label: "Electricity (Feb)", value: "482,190", unit: "kWh" },
  ]);
  const [dataTableRows, setDataTableRows] = useState<Array<{ metric: string; value: string; unit: string; ref: string; conf: string }>>([
    { metric: "Scope 1 (stationary + mobile)", value: "1,842", unit: "tCO₂e", ref: "E1-1", conf: "94%" },
  ]);
  const [validationChecks, setValidationChecks] = useState<Array<{ id: string; label: string; status: 'pass' | 'warn' | 'fail'; note?: string }>>([
    { id: 'v1', label: "Scope 1+2 total vs 2024 CDP filing", status: 'pass' },
    { id: 'v2', label: "Water data coverage ≥ 80%", status: 'warn', note: "Currently 67%" },
  ]);

  // Command + sim engine
  const [command, setCommand] = useState("");
  const [scriptIndex, setScriptIndex] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTraceOpen, setIsTraceOpen] = useState(false);

  // Derived
  const stageIndex = STAGES.indexOf(currentStage);
  const progressLabel = `${stageIndex + 1} / ${STAGES.length}`;

  // Utility: push a new log (with optional side effects already handled by caller)
  const pushLog = useCallback((log: Omit<ActivityLog, 'id' | 'timestamp'> & { timestamp?: string }) => {
    const now = new Date();
    const ts = log.timestamp || now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newLog: ActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: ts,
      ...log,
    };
    setActivities(prev => [...prev, newLog]);
    return newLog.id;
  }, []);

  // Toggle log expansion (progressive reveal)
  const toggleLog = (id: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Advance stage + optionally switch view
  const advanceToStage = (stage: Stage, view?: CanvasView) => {
    setCurrentStage(stage);
    if (view) setCurrentView(view);
  };

  // Update focus text
  const setFocus = (text: string) => setCurrentFocus(text);

  // Stream more narrative text (alive typing effect)
  const appendToNarrative = (chunk: string) => {
    setStreamedNarrative(prev => {
      const next = prev + chunk;
      // Also lightly update table / validation as "report writes itself"
      if (chunk.toLowerCase().includes('scope 3')) {
        setDataTableRows(rows => {
          if (rows.find(r => r.metric.includes('Scope 3'))) return rows;
          return [...rows, { metric: "Scope 3 (Category 1 + others)", value: "14,920", unit: "tCO₂e", ref: "E1-1", conf: "82%" }];
        });
      }
      return next;
    });
  };

  // Core simulation stepper
  const runNextScriptStep = useCallback(() => {
    if (scriptIndex >= DEMO_SCRIPT.length) {
      setIsPlaying(false);
      pushLog({ 
        message: "Validation phase complete. Report ready for final review.", 
        status: "done", 
        detail: "All material disclosures populated. Full audit trail exported on demand." 
      });
      return;
    }

    const step = DEMO_SCRIPT[scriptIndex];
    
    // Execute the step
    if (step.advanceStageTo) {
      advanceToStage(step.advanceStageTo, step.view);
    } else if (step.view) {
      setCurrentView(step.view);
    }

    if (step.focus) setFocus(step.focus);

    // Main log
    const logId = pushLog({
      message: step.message,
      status: step.status,
      detail: step.detail,
      meta: step.meta,
    });

    // Side effects
    if (step.addGap) {
      setGaps(prev => [...prev.filter(g => g.id !== step.addGap!.id), step.addGap!]);
    }
    if (step.resolveGapIds && step.resolveGapIds.length) {
      setGaps(prev => prev.filter(g => !step.resolveGapIds!.includes(g.id)));
    }
    if (step.addQuestion) {
      setQuestions(prev => [...prev, step.addQuestion!]);
    }
    if (step.resolveQuestionIds) {
      setQuestions(prev => prev.filter(q => !step.resolveQuestionIds!.includes(q.id)));
    }
    if (step.addSuggestion) {
      setSuggestions(prev => [...prev, step.addSuggestion!]);
    }
    if (step.streamChunk) {
      // Simulate typing by chunking the text gradually
      const words = step.streamChunk.split(/(\s+)/);
      let i = 0;
      const typeInterval = setInterval(() => {
        if (i < words.length) {
          appendToNarrative(words[i]);
          i++;
        } else {
          clearInterval(typeInterval);
        }
      }, 28);
    }

    // If this step had an issue, surface a gentle toast once (trust)
    if (step.status === 'issue') {
      // no auto toast spam; user sees it in stream + right panel
    }

    // Move to next
    const nextIndex = scriptIndex + 1;
    setScriptIndex(nextIndex);

    // Schedule next if still playing
    if (isPlaying) {
      timeoutRef.current = setTimeout(() => {
        runNextScriptStep();
      }, step.delay);
    }
  }, [scriptIndex, isPlaying, pushLog]);

  // Play / Pause control
  const togglePlay = () => {
    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);

    if (nextPlaying) {
      // Resume: schedule the next pending step immediately (small delay feels natural)
      if (scriptIndex < DEMO_SCRIPT.length) {
        timeoutRef.current = setTimeout(() => runNextScriptStep(), 180);
      }
      // restart elapsed ticker
      if (!elapsedIntervalRef.current) {
        elapsedIntervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
      }
    } else {
      // Pause: clear scheduled work
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  };

  // Full restart of the entire demo (great for testing / user replay)
  const restartSession = () => {
    // Clear timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);

    // Reset all state to initial
    setActivities([]);
    setCurrentStage("Collecting data");
    setCurrentView("extraction");
    setCurrentFocus("Initializing session...");
    setIsPlaying(true);
    setElapsed(0);
    setExpandedLogs(new Set());
    setGaps([
      { id: 'gap-water', label: "Water usage (Feb–Apr)", severity: 'high', hint: "WM-03 meter offline per facilities" },
    ]);
    setQuestions([]);
    setSuggestions([
      { id: 'sug-1', text: "Apply 2024 water intensity proxy for Q1 gap (error <7% historically)", impact: "Closes high-severity gap" },
    ]);
    setStreamedNarrative("");
    setExtractedFields([{ label: "Electricity (Feb)", value: "482,190", unit: "kWh" }]);
    setDataTableRows([{ metric: "Scope 1 (stationary + mobile)", value: "1,842", unit: "tCO₂e", ref: "E1-1", conf: "94%" }]);
    setValidationChecks([
      { id: 'v1', label: "Scope 1+2 total vs 2024 CDP filing", status: 'pass' },
      { id: 'v2', label: "Water data coverage ≥ 80%", status: 'warn', note: "Currently 67%" },
    ]);
    setCommand("");
    setScriptIndex(0);
    setIsTraceOpen(false);

    // Kick off fresh
    setTimeout(() => {
      pushLog({ 
        message: "ESG-Sense session started", 
        status: "done", 
        detail: `Session ${SESSION_ID} • ${COMPANY} • ${FRAMEWORK} ${PERIOD}. All actions are logged and reversible.` 
      });
      // First real step
      timeoutRef.current = setTimeout(() => runNextScriptStep(), 260);
    }, 40);

    // Elapsed ticker
    elapsedIntervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);

    toast.success("Session restarted", { description: "Fresh AI run. All previous state cleared." });
  };

  // Export full audit trail (audit-friendly)
  const exportAuditTrail = () => {
    const lines: string[] = [];
    lines.push(`ESG-SENSE AUDIT TRAIL`);
    lines.push(`Company: ${COMPANY}`);
    lines.push(`Framework: ${FRAMEWORK}`);
    lines.push(`Period: ${PERIOD}`);
    lines.push(`Session: ${SESSION_ID}`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Final Stage: ${currentStage}`);
    lines.push(`Total AI steps logged: ${activities.length}`);
    lines.push(``);
    lines.push(`=== ACTIVITY STREAM (chronological) ===`);
    activities.forEach((a, idx) => {
      lines.push(`${a.timestamp}  [${a.status.toUpperCase()}]  ${a.message}`);
      if (a.detail) lines.push(`    Detail: ${a.detail}`);
      if (a.meta) lines.push(`    Meta: ${JSON.stringify(a.meta)}`);
    });
    lines.push(``);
    lines.push(`=== USER INTERVENTIONS & RESOLUTIONS ===`);
    // Simple heuristic: any user-status logs + remaining open gaps
    const userActions = activities.filter(a => a.status === 'user');
    if (userActions.length === 0) lines.push("(none recorded in this session)");
    else userActions.forEach(a => lines.push(`- ${a.timestamp} ${a.message}`));
    
    lines.push(``);
    lines.push(`=== OPEN DATA GAPS AT EXPORT ===`);
    if (gaps.length === 0) lines.push("None — all gaps resolved or accepted.");
    else gaps.forEach(g => lines.push(`- [${g.severity}] ${g.label}: ${g.hint}`));

    lines.push(``);
    lines.push(`=== REPORT SNAPSHOT (partial) ===`);
    lines.push(streamedNarrative || "(narrative generation not yet started)");

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ESG-Sense-Audit-${SESSION_ID}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    pushLog({ message: "Exported full audit trail (text)", status: "user" });
    toast.success("Audit trail downloaded", { description: "Contains complete traceable log + user decisions." });
  };

  // Resolve a gap + inject trustworthy log (user guided the AI)
  const resolveGap = (gapId: string, method: string = "manual") => {
    const gap = gaps.find(g => g.id === gapId);
    if (!gap) return;

    setGaps(prev => prev.filter(g => g.id !== gapId));

    const msg = method === "estimate" 
      ? `Used 2024 proxy for ${gap.label} (1,240 m³/mo avg)` 
      : `User supplied data for ${gap.label}`;

    pushLog({
      message: msg,
      status: "user",
      detail: method === "estimate" 
        ? "Proxy accepted. Historical variance <7%. Reversible via command layer." 
        : "Data written to working set. Will be included in final disclosure E2-4.",
      meta: { source: "User intervention" }
    });

    // Light enrichment of canvas data
    if (gapId.includes('water')) {
      setDataTableRows(prev => {
        if (prev.some(r => r.metric.toLowerCase().includes('water'))) return prev;
        return [...prev, { metric: "Water withdrawal (est.)", value: "3,720", unit: "m³", ref: "E2-4 / GRI 303", conf: "proxy" }];
      });
      setValidationChecks(prev => prev.map(v => 
        v.id === 'v2' ? { ...v, status: 'pass', note: 'Resolved via proxy' } : v
      ));
    }

    toast.success("Gap resolved", { description: msg });
  };

  // Answer an AI question (user guides)
  const answerQuestion = (qId: string, answer: "yes" | "no" | "edit") => {
    const q = questions.find(qq => qq.id === qId);
    if (!q) return;

    setQuestions(prev => prev.filter(qq => qq.id !== qId));

    if (answer === "yes") {
      pushLog({
        message: `Accepted: ${q.text}`,
        status: "user",
        detail: "Proxy applied. Data now marked as 'estimated – methodology disclosed'.",
      });
      resolveGap('gap-water', 'estimate');
      // improve validation
      setValidationChecks(prev => prev.map(v => v.id === 'v2' ? {...v, status: 'pass', note: 'Proxy accepted'} : v));
    } else if (answer === "no") {
      pushLog({
        message: "Declined proxy for water data. Awaiting manual upload.",
        status: "user",
      });
    } else {
      // edit path – treat like provide data
      pushLog({ message: "Opened manual value entry for water data", status: "user" });
      // simulate quick entry
      setTimeout(() => resolveGap('gap-water', 'manual'), 420);
    }
  };

  // Dismiss or apply a suggestion
  const handleSuggestion = (sugId: string, action: "apply" | "dismiss") => {
    const sug = suggestions.find(s => s.id === sugId);
    if (!sug) return;

    setSuggestions(prev => prev.filter(s => s.id !== sugId));

    if (action === "apply") {
      pushLog({
        message: "Applied suggestion: water intensity proxy",
        status: "user",
        detail: "Impact: closed data gap + improved completeness score.",
      });
      resolveGap('gap-water', 'estimate');
      toast.info("Suggestion applied", { description: "Report updated with recommended proxy." });
    } else {
      pushLog({ message: "Dismissed AI suggestion", status: "user" });
    }
  };

  // Command layer — user guides the AI in natural language
  const submitCommand = () => {
    const raw = command.trim();
    if (!raw) return;

    const lower = raw.toLowerCase();
    pushLog({ message: `User: ${raw}`, status: "user" });

    // Smart interpretation (makes it feel like a real agent)
    if (lower.includes("skip") || lower.includes("ignore") || lower.includes("omit")) {
      pushLog({ 
        message: "Acknowledged. Skipping affected data source per instruction.", 
        status: "done", 
        detail: "Relevant items marked non-material. Full rationale captured in audit trail." 
      });
      // resolve first high gap if exists
      if (gaps.length) resolveGap(gaps[0].id, 'manual');
    } 
    else if (lower.includes("estimate") || lower.includes("proxy") || lower.includes("last year")) {
      pushLog({ message: "Using last-year / industry proxy for missing values.", status: "done" });
      if (gaps.some(g => g.id.includes('water'))) resolveGap('gap-water', 'estimate');
    } 
    else if (lower.includes("explain") || lower.includes("why") || lower.includes("how") || lower.includes("detail")) {
      const explainLog = pushLog({
        message: "Providing full reasoning trace for current mapping decisions",
        status: "done",
        detail: "All mapping uses documented emission factors (EPA 2024 + supplier-specific). Every datapoint is reversible and carries confidence + source lineage. See expanded items in activity stream.",
      });
      setExpandedLogs(prev => new Set([...prev, explainLog]));
      setIsTraceOpen(true);
    } 
    else if (lower.includes("pause") || lower.includes("stop")) {
      if (isPlaying) togglePlay();
      pushLog({ message: "Simulation paused by user command.", status: "user" });
    } 
    else if (lower.includes("resume") || lower.includes("continue")) {
      if (!isPlaying) togglePlay();
    } 
    else if (lower.includes("faster")) {
      pushLog({ message: "Speed increase requested (demo only – steps remain paced for readability).", status: "done" });
    } 
    else if (lower.includes("upload") || lower.includes("water")) {
      // Trigger the file picker flow
      fileInputRef.current?.click();
    } 
    else {
      // Default calm acknowledgement + slight steering
      pushLog({ 
        message: "Understood. Continuing with current plan unless gaps require intervention.", 
        status: "done" 
      });
    }

    setCommand("");
  };

  // Simulated file upload (resolves packaging or water gap)
  const simulateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isWater = gaps.some(g => g.id === 'gap-water');
    const targetGap = isWater ? 'gap-water' : 'gap-packaging';

    pushLog({
      message: `User uploaded: ${file.name}`,
      status: "user",
      detail: "File validated. Extracted 3 new fields. Data merged into working set.",
    });

    if (gaps.find(g => g.id === targetGap)) {
      resolveGap(targetGap, 'manual');
    } else {
      // fallback: just close the remaining one
      if (gaps.length) resolveGap(gaps[0].id, 'manual');
    }

    // Bonus: add a field to extraction view
    setExtractedFields(prev => [...prev, { label: "Water (Mar)", value: "1,180", unit: "m³" }]);

    // reset input
    e.target.value = "";
    toast.success("File processed", { description: `${file.name} contributed 3 datapoints.` });
  };

  // Trigger hidden upload from right panel CTA
  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  // Keyboard niceties (bottom bar focused by default)
  const handleCommandKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitCommand();
    }
    if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
      // nice shortcut: focus command bar
      e.preventDefault();
      (document.querySelector('.command-input') as HTMLInputElement)?.focus();
    }
  };

  // Boot the simulation on first mount
  useEffect(() => {
    // Seed the very first log
    pushLog({ 
      message: "ESG-Sense session started", 
      status: "done", 
      detail: `Session ${SESSION_ID} • ${COMPANY} • ${FRAMEWORK} ${PERIOD}. Every step is traceable and reversible.` 
    });

    // Start the ticker
    elapsedIntervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);

    // Kick the first scripted step after a calm pause
    timeoutRef.current = setTimeout(() => {
      runNextScriptStep();
    }, 620);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep elapsed ticking only while playing
  useEffect(() => {
    if (isPlaying && !elapsedIntervalRef.current) {
      elapsedIntervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else if (!isPlaying && elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }
  }, [isPlaying]);

  // Helper to render individual activity row (heart of trust)
  const ActivityItem = ({ log }: { log: ActivityLog }) => {
    const isExpanded = expandedLogs.has(log.id);
    const StatusIcon = log.status === 'running' ? Loader2 
                     : log.status === 'done' ? CheckCircle2 
                     : log.status === 'issue' ? AlertTriangle 
                     : User;

    return (
      <div 
        onClick={() => toggleLog(log.id)} 
        className={`log-row group ${isExpanded ? 'expanded' : ''} text-[13px] flex flex-col gap-0.5`}
      >
        <div className="flex items-start gap-2">
          <div className="font-mono text-[11px] text-zinc-500 w-[62px] shrink-0 pt-0.5 tabular-nums">{log.timestamp}</div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-zinc-200 leading-tight">{log.message}</span>
              {log.status === 'running' && <span className="pulse-dot mt-1" />}
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-1.5">
            <span className={`status-badge status-${log.status}`}>
              {log.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
              {log.status === 'done' && <CheckCircle2 className="w-3 h-3" />}
              {log.status === 'issue' && <AlertTriangle className="w-3 h-3" />}
              {log.status === 'user' && <User className="w-3 h-3" />}
              <span>{log.status}</span>
            </span>
            {log.detail && (
              isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
            )}
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && log.detail && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: 'auto' }} 
              exit={{ opacity: 0, height: 0 }}
              className="detail-block"
            >
              <div>{log.detail}</div>
              {log.meta && (
                <div className="text-[11px] text-zinc-500 pt-0.5">
                  {log.meta.source && <>Source: {log.meta.source} • </>}
                  {log.meta.confidence !== undefined && <>Confidence: {log.meta.confidence}% • </>}
                  {log.meta.durationMs && <>Processed in {log.meta.durationMs}ms</>}
                </div>
              )}
              <div className="pt-1 text-[10px] text-zinc-500">This action is fully reversible. All inputs captured for audit.</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // Dynamic center canvas renderer (the "alive" part)
  const renderCanvas = () => {
    if (currentView === 'extraction') {
      return (
        <div className="canvas-paper h-full">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-medium text-zinc-300">Document Processing</div>
              <div className="text-xs text-zinc-500">Pacific Power • Feb 2025 utility statement (PDF, 4 pages)</div>
            </div>
            <div className="text-emerald-400 text-xs flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> 3 fields extracted</div>
          </div>

          <div className="grid grid-cols-5 gap-4">
            {/* Mock PDF page */}
            <div className="col-span-3 border border-zinc-700 bg-zinc-950 rounded-lg p-4 text-[12px] leading-[1.45] font-mono text-zinc-400 overflow-hidden">
              <div className="text-emerald-400/80 mb-1">PACIFIC POWER — COMMERCIAL STATEMENT</div>
              <div>Account: 447-2219-884 • Service: Feb 1–28 2025</div>
              <div className="my-2 h-px bg-zinc-800" />
              <div>Meter ID: <span className="extracted-field">EL-4821-A</span></div>
              <div>Usage: <span onClick={() => { /* manual highlight demo */ }} className="extracted-field cursor-pointer">482,190 kWh</span> (actual)</div>
              <div>Demand: 812 kW peak</div>
              <div className="mt-1 text-[11px] text-zinc-600">Bill total: $58,421.90</div>
              <div className="mt-3 text-amber-400/60 text-[11px]">⚠ Page 3 is low-contrast scan — supplier invoice</div>
            </div>

            {/* Live extracted fields */}
            <div className="col-span-2">
              <div className="uppercase text-[10px] tracking-widest text-zinc-500 mb-2">EXTRACTED FIELDS (live)</div>
              <div className="space-y-1.5">
                {extractedFields.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-sm">
                    <span className="text-zinc-400">{f.label}</span>
                    <span className="font-mono text-emerald-300">{f.value} {f.unit}</span>
                  </div>
                ))}
                <div className="text-[11px] text-zinc-500 pt-1">AI is still scanning pages 2–4…</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (currentView === 'structuring') {
      return (
        <div className="canvas-paper h-full">
          <div className="mb-3">
            <div className="text-sm font-medium">Data Table — Forming in real time</div>
            <div className="text-xs text-zinc-500">Rows appended and enriched as mapping progresses</div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
                <th>Unit</th>
                <th>Framework</th>
                <th>Conf.</th>
              </tr>
            </thead>
            <tbody>
              {dataTableRows.map((row, idx) => (
                <tr key={idx}>
                  <td className="font-medium text-zinc-200">{row.metric}</td>
                  <td className="font-mono">{row.value}</td>
                  <td className="text-zinc-400">{row.unit}</td>
                  <td><span className="font-mono text-xs bg-zinc-800 px-1.5 py-px rounded">{row.ref}</span></td>
                  <td className={row.conf === 'proxy' ? 'text-amber-400' : 'text-emerald-400'}>{row.conf}</td>
                </tr>
              ))}
              {dataTableRows.length < 4 && (
                <tr>
                  <td colSpan={5} className="py-3 text-xs text-zinc-500 italic">AI is calculating Scope 3 Category 1 (Purchased goods) …</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="mt-4 text-[11px] text-zinc-500">All values carry full lineage back to source documents or user overrides.</div>
        </div>
      );
    }

    if (currentView === 'narrative') {
      return (
        <div className="canvas-paper h-full font-serif">
          <div className="prose prose-invert max-w-none text-[14px]">
            <div className="whitespace-pre-wrap leading-relaxed text-zinc-200">
              {streamedNarrative || (
                <span className="text-zinc-500 italic">ESG-Sense is composing the report narrative…</span>
              )}
              {streamedNarrative && <span className="inline-block w-1.5 h-4 align-[-1px] bg-emerald-400 ml-0.5 animate-pulse" />}
            </div>
          </div>
          <div className="mt-6 text-xs text-emerald-400/70 flex items-center gap-1.5 border-t border-zinc-800 pt-3">
            <ShieldCheck className="w-3.5 h-3.5" /> Every sentence above is traceable to one or more source activities in the left panel.
          </div>
        </div>
      );
    }

    // validation
    return (
      <div className="canvas-paper h-full">
        <div className="text-sm font-medium mb-3 flex items-center gap-2">
          <ShieldCheck className="text-emerald-400" /> Validation &amp; Completeness
        </div>
        <div className="space-y-2">
          {validationChecks.map((check, i) => (
            <div key={i} className="flex items-start gap-3 border border-zinc-800 bg-zinc-950 rounded-lg px-4 py-3">
              <div className="mt-0.5">
                {check.status === 'pass' && <CheckCircle2 className="text-emerald-400 w-4 h-4" />}
                {check.status === 'warn' && <AlertTriangle className="text-amber-400 w-4 h-4" />}
              </div>
              <div className="flex-1 text-sm">
                {check.label}
                {check.note && <div className="text-xs text-amber-400/90 mt-0.5">{check.note}</div>}
              </div>
              <div className={`text-xs px-2 py-0.5 rounded ${check.status === 'pass' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                {check.status}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 text-[12px] text-zinc-500">All checks are deterministic and re-runnable. Full calculation scripts attached to audit export.</div>
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-zinc-950 text-zinc-200 font-sans">
      {/* TOP BAR — context only, calm and authoritative */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur z-20 flex items-center px-4 text-sm shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 font-semibold tracking-tight text-lg">
            <Zap className="w-5 h-5 text-emerald-400" /> ESG-Sense
          </div>
          <div className="text-zinc-400">•</div>
          <div className="font-medium truncate">{COMPANY}</div>
          <div className="px-2 py-0.5 text-[10px] rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono tracking-wider">{FRAMEWORK}</div>
          <div className="text-xs text-zinc-500">{PERIOD}</div>
        </div>

        <div className="flex-1" />

        {/* Status + Stage progress (not a crude %) */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="pulse-dot" />
            <span className="font-medium">Generating report…</span>
          </div>

          {/* Stage pills — structured, audit-friendly */}
          <div className="flex items-center gap-1.5 pl-3 border-l border-zinc-800">
            {STAGES.map((stage, idx) => {
              const isActive = idx === stageIndex;
              const isComplete = idx < stageIndex;
              return (
                <div 
                  key={idx} 
                  className={`stage-pill text-center ${isActive ? 'active' : isComplete ? 'complete' : 'pending'}`}
                  title={stage}
                >
                  {stage.split(" ")[0]}
                </div>
              );
            })}
            <div className="text-[10px] font-mono text-zinc-500 pl-1 tabular-nums">{progressLabel}</div>
          </div>

          <div className="font-mono text-xs text-zinc-500 pl-2 border-l border-zinc-800 tabular-nums">
            {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
          </div>

          <button 
            onClick={togglePlay} 
            className="flex items-center gap-1.5 px-3 py-1 rounded-md border border-zinc-700 hover:bg-zinc-900 active:bg-zinc-800 transition text-xs"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? "Pause" : "Resume"}
          </button>

          <button 
            onClick={restartSession} 
            className="flex items-center gap-1.5 px-3 py-1 rounded-md border border-zinc-700 hover:bg-zinc-900 active:bg-zinc-800 transition text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restart
          </button>

          <button 
            onClick={exportAuditTrail} 
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-900 border border-zinc-700 hover:bg-emerald-950 hover:border-emerald-800 active:bg-emerald-900/50 transition text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" /> Export audit trail
          </button>
        </div>
      </div>

      {/* 3-PANE MAIN AREA */}
      <div className="flex-1 grid grid-cols-[320px,1fr,300px] overflow-hidden">
        
        {/* LEFT: AI ACTIVITY STREAM — the heart, human-readable system thinking */}
        <div className="flex flex-col border-r border-zinc-800 bg-zinc-950 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-zinc-800 flex items-center justify-between text-xs uppercase tracking-[1px] text-zinc-500 shrink-0">
            <div className="flex items-center gap-2">
              AI ACTIVITY STREAM <span className="font-mono text-emerald-400/60">LIVE</span>
            </div>
            <button onClick={() => setIsTraceOpen(true)} className="text-[10px] px-2 py-0.5 rounded border border-zinc-800 hover:bg-zinc-900">Full trace</button>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 scrollbar-thin space-y-px text-sm" id="activity-stream">
            <AnimatePresence initial={false}>
              {activities.length === 0 && (
                <div className="text-center text-xs text-zinc-500 py-8">Waiting for first AI action…</div>
              )}
              {activities.map(log => (
                <motion.div 
                  key={log.id} 
                  initial={{ opacity: 0, y: 6 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.12 }}
                >
                  <ActivityItem log={log} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="border-t border-zinc-800 p-2 flex gap-2 shrink-0 bg-zinc-950">
            <button 
              onClick={togglePlay} 
              className="flex-1 flex justify-center items-center gap-2 text-xs py-1.5 rounded border border-zinc-700 hover:bg-zinc-900 active:bg-zinc-800"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? "Pause AI" : "Resume AI"}
            </button>
            <button 
              onClick={exportAuditTrail} 
              className="flex items-center gap-1.5 px-3 text-xs rounded border border-zinc-700 hover:bg-zinc-900"
            >
              <Download className="w-3.5 h-3.5" /> Log
            </button>
          </div>
        </div>

        {/* CENTER: WORKING CANVAS — dynamic and alive */}
        <div className="flex flex-col overflow-hidden bg-zinc-900">
          <div className="px-4 py-2 border-b border-zinc-800 text-[11px] flex items-center gap-3 shrink-0 bg-zinc-950/60">
            <div className="font-medium tracking-wider text-zinc-400">WORKING CANVAS</div>
            <div className="text-emerald-400/90 flex items-center gap-1.5">
              <span className="font-mono">{currentStage.toUpperCase()}</span> 
              <span className="text-zinc-600">·</span> 
              <span>{currentFocus}</span>
            </div>
            <div className="flex-1" />
            <div className="text-[10px] text-zinc-500">Everything here is generated from the activity on the left</div>
          </div>

          <div className="flex-1 overflow-auto p-4 bg-[radial-gradient(#27272a_0.6px,transparent_1px)] bg-[length:4px_4px]">
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentView + currentStage} 
                initial={{ opacity: 0.6, y: 4 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="h-full"
              >
                {renderCanvas()}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="px-4 py-2 text-[10px] text-zinc-500 border-t border-zinc-800 flex items-center gap-2 shrink-0 bg-zinc-950/70">
            <MessageSquare className="w-3 h-3" /> 
            The canvas updates live as the AI works. Click any log on the left to inspect its contribution.
          </div>
        </div>

        {/* RIGHT: HUMAN CONTROL LAYER — where the user steps in */}
        <div className="flex flex-col border-l border-zinc-800 bg-zinc-950 overflow-hidden text-sm">
          <div className="px-3 py-2.5 border-b border-zinc-800 text-xs uppercase tracking-[1px] text-zinc-400 shrink-0">
            HUMAN CONTROL LAYER
          </div>

          {/* Data gaps */}
          <div className="p-3 border-b border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <div className="uppercase text-[10px] text-amber-400 tracking-widest">DATA GAPS {gaps.length > 0 && `(${gaps.length})`}</div>
              <button onClick={triggerUpload} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 active:bg-amber-500/30">
                <Upload className="w-3 h-3" /> UPLOAD
              </button>
            </div>

            {gaps.length === 0 ? (
              <div className="text-emerald-400 text-xs py-1 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> All gaps resolved or accepted.</div>
            ) : (
              <div className="space-y-2">
                {gaps.map(gap => (
                  <div key={gap.id} className="control-card">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 text-amber-400 w-4 h-4 shrink-0" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-amber-300">{gap.label}</div>
                        <div className="text-xs text-zinc-400 mt-0.5">{gap.hint}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => resolveGap(gap.id, 'manual')} className="text-xs flex-1 rounded border border-zinc-700 py-1 hover:bg-zinc-900">Enter manually</button>
                      <button onClick={() => resolveGap(gap.id, 'estimate')} className="text-xs flex-1 rounded border border-zinc-700 py-1 hover:bg-zinc-900">Use estimate</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Questions — user steers the AI */}
          <div className="p-3 border-b border-zinc-800">
            <div className="uppercase text-[10px] text-sky-400 tracking-widest mb-2">AI QUESTIONS</div>
            {questions.length === 0 ? (
              <div className="text-xs text-zinc-500 py-1">No open questions — AI is proceeding autonomously.</div>
            ) : (
              questions.map(q => (
                <div key={q.id} className="control-card">
                  <div className="text-sm">{q.text}</div>
                  {q.context && <div className="text-xs text-zinc-400 mt-1">{q.context}</div>}
                  <div className="flex gap-2 mt-3 text-xs">
                    <button onClick={() => answerQuestion(q.id, "yes")} className="flex-1 py-1 rounded bg-emerald-600/90 hover:bg-emerald-600 active:bg-emerald-700 text-white">Yes, use proxy</button>
                    <button onClick={() => answerQuestion(q.id, "no")} className="flex-1 py-1 rounded border border-zinc-700 hover:bg-zinc-900">No</button>
                    <button onClick={() => answerQuestion(q.id, "edit")} className="px-3 py-1 rounded border border-zinc-700 hover:bg-zinc-900">Edit value…</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Suggestions (minimal, not overwhelming) */}
          <div className="p-3 flex-1 overflow-auto scrollbar-thin">
            <div className="uppercase text-[10px] text-zinc-400 tracking-widest mb-2">SUGGESTIONS</div>
            {suggestions.length === 0 ? (
              <div className="text-xs text-zinc-500">None at the moment.</div>
            ) : (
              suggestions.map(s => (
                <div key={s.id} className="control-card">
                  <div className="text-sm leading-snug">{s.text}</div>
                  {s.impact && <div className="text-emerald-400/80 text-xs mt-1">{s.impact}</div>}
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => handleSuggestion(s.id, "apply")} className="text-xs px-3 py-1 rounded bg-emerald-600/90 text-white hover:bg-emerald-600">Apply</button>
                    <button onClick={() => handleSuggestion(s.id, "dismiss")} className="text-xs px-3 py-1 rounded border border-zinc-700 hover:bg-zinc-900">Dismiss</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 text-[10px] text-zinc-500 border-t border-zinc-800">All interventions are logged with your identity and timestamp for the audit file.</div>
        </div>
      </div>

      {/* BOTTOM: COMMAND LAYER — natural language agent control */}
      <div className="h-14 border-t border-zinc-800 bg-zinc-950 px-3 flex items-center gap-2 shrink-0 z-10">
        <div className="font-mono text-xs px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded text-emerald-400/90 tracking-widest">ASK ESG-SENSE</div>

        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleCommandKey}
          placeholder='Type a command…  "use last year estimate"  •  "explain this mapping"  •  "skip water data"  •  "upload water usage"'
          className="command-input"
        />

        <button 
          onClick={submitCommand} 
          disabled={!command.trim()} 
          className="px-5 py-2 rounded-lg bg-white text-zinc-950 text-sm font-medium disabled:opacity-40 active:bg-zinc-200 transition"
        >
          Send
        </button>

        <div className="pl-2 text-[10px] text-zinc-500 hidden md:block">Press <span className="font-mono">Enter</span> • <span className="font-mono">/</span> focuses input</div>
      </div>

      {/* Hidden file input for realistic upload simulation */}
      <input 
        ref={fileInputRef} 
        type="file" 
        className="hidden" 
        onChange={simulateUpload} 
        accept=".pdf,.xlsx,.csv,.txt" 
      />

      {/* Full trace modal (expert / audit view) — progressive reveal */}
      <AnimatePresence>
        {isTraceOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-center justify-center p-6" onClick={() => setIsTraceOpen(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.985, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.985, y: 6 }}
              transition={{ duration: 0.1 }}
              onClick={e => e.stopPropagation()}
              className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[82vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="font-semibold">Full machine trace — {SESSION_ID}</div>
                  <div className="text-xs text-zinc-500">This is the low-level log. Human-readable version lives in the activity stream.</div>
                </div>
                <button onClick={() => setIsTraceOpen(false)} className="text-zinc-400 hover:text-white">Close</button>
              </div>
              <div className="flex-1 overflow-auto p-5 font-mono text-xs bg-black/60 text-emerald-300/90 space-y-1 scrollbar-thin">
                {activities.map((a, idx) => (
                  <div key={idx} className="whitespace-pre-wrap border-l border-zinc-800 pl-3 py-0.5">{a.timestamp} — {a.status} — {a.message}{a.detail ? `\n    ${a.detail}` : ''}</div>
                ))}
                {activities.length === 0 && <div className="text-zinc-500">No steps yet.</div>}
              </div>
              <div className="p-3 border-t border-zinc-800 text-[11px] text-zinc-500 flex justify-between items-center">
                <div>This trace + all user decisions are included in the exported audit file.</div>
                <button onClick={exportAuditTrail} className="px-3 py-1 rounded border border-zinc-700 text-emerald-400 hover:bg-zinc-900 text-xs">Export full audit now</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

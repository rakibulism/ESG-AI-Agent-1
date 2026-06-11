"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

const STAGES = ["Collecting data", "Cleaning data", "Mapping to framework", "Generating report", "Validating"] as const;
type Stage = typeof STAGES[number];

const COMPANY = "Verdant Manufacturing Inc.";

interface ActivityLog {
  id: string;
  timestamp: string;
  message: string;
  status: "running" | "done" | "issue" | "user";
  detail?: string;
  meta?: string;
  reasoning?: string;
}

interface DataGap {
  id: string;
  label: string;
  severity: "high" | "medium" | "low";
  hint: string;
}

interface AIQuestion {
  id: string;
  text: string;
}

interface Suggestion {
  id: string;
  text: string;
}

interface DemoStep {
  phase: string;
  delay: number;
  message: string;
  status: ActivityLog["status"];
  detail?: string;
  meta?: string;
  reasoning?: string;
  addGap?: DataGap;
  addQuestion?: AIQuestion;
  advance?: Stage;
}

const DEMO_SCRIPT: DemoStep[] = [
  { phase: "Data Collection", delay: 420, message: "Connected to QuickBooks", status: "done" as const },
  { phase: "Data Collection", delay: 820, message: "Reading your utility bill for March", status: "running" as const },
  { phase: "Data Collection", delay: 1350, message: "Found 482,190 kWh of electricity in the March bill", status: "done" as const, meta: "Source: PDF", reasoning: "Detected total: 482,190 kWh" },
  { phase: "Data Processing", delay: 680, message: "Organizing the numbers so they make sense", status: "running" as const },
  { phase: "Data Processing", delay: 920, message: "Looks like we’re missing water usage for Feb–Apr", status: "issue" as const, addGap: { id: "gap-water", label: "Water usage for Feb–Apr", severity: "high" as const, hint: "Meter WM-03 seems to have been offline" } },
  { phase: "Data Processing", delay: 780, message: "Cleaned up the natural gas numbers", status: "done" as const },
  { phase: "Data Processing", delay: 1100, message: "Mapping your natural gas to Scope 1", status: "running" as const },
  { phase: "Report Building", delay: 940, message: "Your natural gas and fleet emissions equal 1,842 tCO₂e", status: "done" as const, advance: "Generating report" as const },
  { phase: "Report Building", delay: 520, message: "Writing the executive summary", status: "running" as const },
  { phase: "Report Building", delay: 1350, message: "Adding the detailed emissions numbers", status: "running" as const },
];

export default function ESGSenseLive() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [currentStage, setCurrentStage] = useState<Stage>("Collecting data");
  const [isPlaying, setIsPlaying] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(["Data Collection"]));
  const [gaps, setGaps] = useState<DataGap[]>([
    { id: "gap-water", label: "Water usage for Feb–Apr", severity: "high", hint: "Meter WM-03 seems to have been offline" },
  ]);
  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([
    { id: "sug-1", text: "Apply 2024 water intensity proxy for the gap (historical variance <7%)" },
  ]);
  const [command, setCommand] = useState("");
  const [scriptIndex, setScriptIndex] = useState(0);
  const [narrativeSubtitle, setNarrativeSubtitle] = useState("We’re organizing your sustainability data into a structured report.");
  const [isWriting, setIsWriting] = useState(false);
  const [dragOverGap, setDragOverGap] = useState<string | null>(null);
  const [pendingUploadGapId, setPendingUploadGapId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const logCountRef = useRef(0);
  const scriptIndexRef = useRef(0);
  const isPlayingRef = useRef(true);
  const runNextRef = useRef<(() => void) | null>(null);

  const pushLog = useCallback((log: Omit<ActivityLog, "id" | "timestamp">) => {
    const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    logCountRef.current += 1;
    const newLog: ActivityLog = { id: `log-${logCountRef.current}`, timestamp: ts, ...log };
    setActivities(prev => [...prev, newLog]);
  }, []);

  const toggleLog = (id: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const togglePhase = (name: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const resolveGap = (id: string) => {
    setGaps(prev => prev.filter(g => g.id !== id));
    pushLog({ message: "User provided the missing data", status: "user" });
    toast.success("Gap resolved");
  };

  const answerQuestion = (id: string, yes: boolean) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
    if (yes) {
      resolveGap("gap-water");
      pushLog({ message: "Accepted the proxy estimate for water", status: "user" });
    } else {
      pushLog({ message: "Declined the proxy. Awaiting manual data.", status: "user" });
    }
  };

  const handleSuggestion = (id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
    resolveGap("gap-water");
    pushLog({ message: "Applied the suggested proxy", status: "user" });
  };

  const submitCommand = () => {
    const raw = command.trim();
    if (!raw) return;
    pushLog({ message: "User: " + raw, status: "user" });
    const lower = raw.toLowerCase();
    if (lower.includes("estimate") || lower.includes("proxy")) {
      resolveGap("gap-water");
    } else if (lower.includes("explain")) {
      setExpandedLogs(prev => new Set([...prev, activities[activities.length-1]?.id || ""]));
    }
    setCommand("");
  };

  const handleCommandKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitCommand();
    }
  };

  const handleFileUpload = (file: File, gapId: string) => {
    if (!file || !gapId) return;
    pushLog({ 
      message: `User uploaded ${file.name} for ${gaps.find(g => g.id === gapId)?.label || 'data gap'}`, 
      status: "user" 
    });
    resolveGap(gapId);
    toast.success(`File "${file.name}" uploaded and processed`);
    setPendingUploadGapId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent, gapId: string) => {
    e.preventDefault();
    setDragOverGap(null);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file, gapId);
    }
  };

  const handleDragOver = (e: React.DragEvent, gapId: string) => {
    e.preventDefault();
    setDragOverGap(gapId);
  };

  const handleDragLeave = () => {
    setDragOverGap(null);
  };

  const runNext = useCallback(() => {
    const idx = scriptIndexRef.current;
    if (idx >= DEMO_SCRIPT.length) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      return;
    }
    const step = DEMO_SCRIPT[idx];
    pushLog({ message: step.message, status: step.status, detail: step.detail, meta: step.meta, reasoning: step.reasoning });

    const gap = step.addGap;
    if (gap) setGaps(prev => (prev.some(g => g.id === gap.id) ? prev : [...prev, gap]));
    const question = step.addQuestion;
    if (question) setQuestions(prev => (prev.some(q => q.id === question.id) ? prev : [...prev, question]));
    if (step.advance) setCurrentStage(step.advance);

    scriptIndexRef.current = idx + 1;
    setScriptIndex(idx + 1);

    if (isPlayingRef.current) {
      timeoutRef.current = setTimeout(() => runNextRef.current?.(), step.delay);
    }
  }, [pushLog]);

  useEffect(() => {
    runNextRef.current = runNext;
  }, [runNext]);

  const togglePlay = () => {
    const next = !isPlaying;
    isPlayingRef.current = next;
    setIsPlaying(next);
    if (next && scriptIndexRef.current < DEMO_SCRIPT.length) {
      timeoutRef.current = setTimeout(runNext, 300);
    } else if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  useEffect(() => {
    const startTimeout = setTimeout(() => {
      pushLog({ message: "ESG-Sense session started", status: "done" });
      timeoutRef.current = setTimeout(runNext, 400);
    }, 80);
    return () => {
      clearTimeout(startTimeout);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [pushLog, runNext]);

  const restartSession = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setActivities([]);
    setCurrentStage("Collecting data");
    setIsPlaying(true);
    setExpandedLogs(new Set());
    setExpandedPhases(new Set(["Data Collection"]));
    setGaps([{ id: "gap-water", label: "Water usage for Feb–Apr", severity: "high", hint: "Meter WM-03 seems to have been offline" }]);
    setQuestions([]);
    setSuggestions([{ id: "sug-1", text: "Apply 2024 water intensity proxy for the gap (historical variance <7%)" }]);
    setCommand("");
    setScriptIndex(0);
    setNarrativeSubtitle("We’re organizing your sustainability data into a structured report.");
    setIsWriting(false);
    logCountRef.current = 0;
    scriptIndexRef.current = 0;
    isPlayingRef.current = true;

    setTimeout(() => {
      pushLog({ message: "ESG-Sense session started", status: "done" });
      timeoutRef.current = setTimeout(runNext, 400);
    }, 80);
  };

  const exportAuditTrail = () => {
    const text = `ESG-Sense Audit Trail\n${activities.map(a => `${a.timestamp} ${a.message}`).join("\n")}`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ESG-Sense-Audit.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  const phasesWithActivities = [
    { name: "Data Collection", progress: "3/4", activities: activities.filter((_,i) => i < 4) },
    { name: "Data Processing", progress: "2/3", activities: activities.filter((_,i) => i >=4 && i < 8) },
    { name: "Report Building", progress: "1/2", activities: activities.filter((_,i) => i >=8) },
  ];

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: '#F7F8FA' }}>
      {/* Quiet top bar */}
      <div className="topbar h-12 flex items-center px-5 text-sm shrink-0">
        <div className="flex items-center gap-3 text-[#1A1A1A]">
          <span className="font-semibold tracking-[-0.2px]">ESG-Sense</span>
          <span className="text-[#4B5563]">·</span>
          <span className="text-sm">{COMPANY}</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-4 text-sm">
          <div className="status-whisper flex items-center gap-2">{narrativeSubtitle}</div>
          <div className="stage-row hidden md:flex">
            {STAGES.map((s, idx) => (
              <div key={idx} className={`stage-pill ${s === currentStage ? 'active' : idx < STAGES.indexOf(currentStage) ? 'complete' : ''}`}>
                {s.split(" ")[0]}
              </div>
            ))}
          </div>
          <div className="text-xs text-[#4B5563] font-mono tabular-nums hidden sm:block">
            ~{Math.max(1, Math.floor((DEMO_SCRIPT.length - scriptIndex) * 0.4))} min remaining
          </div>
          <button onClick={togglePlay} className="soft-btn text-xs px-3 py-1">{isPlaying ? 'Pause' : 'Resume'}</button>
          <button onClick={restartSession} className="text-xs px-2.5 py-1 text-[#4B5563] hover:text-[#1A1A1A]">Restart</button>
          <button onClick={exportAuditTrail} className="text-xs px-2.5 py-1 text-[#4B5563] hover:text-[#1A1A1A]">Export</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden px-5 pt-4 pb-2 gap-6">
        {/* LEFT: Structured Activity Timeline */}
        <div className="w-80 shrink-0 hidden lg:block overflow-y-auto pr-2">
          {phasesWithActivities.map((phase, pIdx) => (
            <div key={pIdx} className="phase-group">
              <div className="phase-header" onClick={() => togglePhase(phase.name)}>
                <span>{phase.name}</span>
                <span className="phase-progress">{phase.progress}</span>
              </div>
              {expandedPhases.has(phase.name) && phase.activities.map((log) => (
                <div key={log.id} onClick={() => toggleLog(log.id)} className={`activity-item ${log.status}`}>
                  <div className={`activity-dot ${log.status}`} />
                  <div className="activity-main">
                    <div className={`activity-sentence ${log.status}`}>{log.message}</div>
                    {log.meta && <div className="activity-meta">→ {log.meta}</div>}
                    {expandedLogs.has(log.id) && log.reasoning && (
                      <div className="activity-reasoning">AI reasoning: {log.reasoning}</div>
                    )}
                    {log.status === 'issue' && (
                      <span className="activity-cta">Fix</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* CENTER: Modular Living Document */}
        <div className="flex-1 min-w-0 flex justify-center overflow-y-auto">
          <div className="w-full max-w-[720px]">
            <div className="section-card">
              <h3>Executive Summary</h3>
              <p className="text-[15px] leading-[1.65]">Verdant Manufacturing reduced Scope 1+2 emissions 11% YoY while growing revenue.</p>
              {isWriting && <div className="text-[#4B5563] text-sm italic mt-2">Writing executive summary…</div>}
            </div>

            <div className="section-card">
              <h3>Energy &amp; Emissions</h3>
              <div className="data-block">
                <div>Scope 1 (natural gas + fleet): <strong>1,842 tCO₂e</strong></div>
                <div>Scope 2 (location-based): <strong>218 tCO₂e</strong></div>
              </div>
            </div>

            <div className="section-card">
              <h3>Data Sources Used</h3>
              {["Electricity → March Utility Bill (PDF)", "Financial Data → QuickBooks", "Fleet Data → Manual Input"].map((src, i) => (
                <div key={i} className="data-source" onClick={() => toast.info(`Source trace: ${src}`)}>
                  {src} <span className="text-xs text-[#4B5563]">view</span>
                </div>
              ))}
            </div>

            <div className="section-card">
              <h3>AI Notes</h3>
              <div className="ai-notes">
                Energy usage increased 12% from last year. Missing water data may affect completeness score.
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Interaction Layer (full - critical per spec) */}
        <div className="w-80 shrink-0 hidden lg:flex flex-col overflow-y-auto space-y-4 pr-1 border-l border-[#F3F4F6] pl-4">
          {/* Data Gaps - soft alert cards */}
          <div className="right-section">
            <h4>Data Gaps</h4>
            {gaps.length > 0 ? gaps.map(gap => (
              <div key={gap.id} className="gap-card">
                <div className="label">Missing data detected</div>
                <div className="hint">{gap.label}</div>
                <div className="text-xs text-[#854D0E] mb-2">{gap.hint}</div>
                
                {/* Modern drag & drop file uploader */}
                <div 
                  className={`modern-uploader ${dragOverGap === gap.id ? 'dragging' : ''}`}
                  onClick={() => {
                    setPendingUploadGapId(gap.id);
                    fileInputRef.current?.click();
                  }}
                  onDragOver={(e) => handleDragOver(e, gap.id)}
                  onDragEnter={(e) => handleDragOver(e, gap.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, gap.id)}
                >
                  <Upload className="w-5 h-5 mb-1 mx-auto" />
                  <div className="text-[11px] font-medium">Drag &amp; drop file here</div>
                  <div className="text-[10px] text-[#6B7280]">or click to browse</div>
                </div>
                
                <div className="gap-ctas mt-2">
                  <button onClick={() => resolveGap(gap.id)}>Enter manually</button>
                  <button onClick={() => resolveGap(gap.id)}>Skip for now</button>
                </div>
              </div>
            )) : <div className="text-xs text-[#4B5563]">No gaps detected.</div>}
          </div>

          {/* AI Questions */}
          <div className="right-section">
            <h4>AI Questions</h4>
            {questions.length > 0 ? questions.map(q => (
              <div key={q.id} className="ai-question-card">
                <div className="question">{q.text}</div>
                <div className="question-ctas">
                  <button onClick={() => answerQuestion(q.id, true)}>Yes, estimate</button>
                  <button onClick={() => answerQuestion(q.id, false)}>No, skip</button>
                  <button onClick={() => {}}>Explain this</button>
                </div>
              </div>
            )) : <div className="text-xs text-[#4B5563]">No questions right now.</div>}
          </div>

          {/* Suggestions (keep minimal) */}
          <div className="right-section">
            <h4>Suggestions</h4>
            {suggestions.length > 0 ? suggestions.map(s => (
              <div key={s.id} className="suggestion-card soft-card cursor-pointer" onClick={() => handleSuggestion(s.id)}>{s.text}</div>
            )) : <div className="text-xs text-[#4B5563]">No suggestions.</div>}
          </div>

          {/* Explainability (small but powerful) */}
          <div className="right-section">
            <h4>How this was calculated</h4>
            <div className="soft-card text-xs cursor-pointer" onClick={() => toast.info("Full methodology available in audit export. All factors are documented and reversible.")}>
              Scope 2 uses location-based emission factors from EPA 2024 tables.
            </div>
          </div>

          {/* Hidden file input for modern uploader */}
          <input 
            ref={fileInputRef} 
            type="file" 
            className="hidden" 
            onChange={(e) => {
              if (pendingUploadGapId && e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0] as File, pendingUploadGapId);
              }
              setPendingUploadGapId(null);
            }} 
          />
        </div>
      </div>

      {/* Bottom Input with suggestions */}
      <div className="px-5 pb-4">
        <div className="suggested-prompts">
          {["Explain Scope 2 mapping", "Use last year’s data", "Skip this source"].map(p => (
            <div key={p} className="suggested-prompt" onClick={() => { setCommand(p); submitCommand(); }}>{p}</div>
          ))}
        </div>
        <div className="command-bar max-w-[620px] mx-auto flex items-center">
          <div className="quick-actions">
            <div className="quick-action" title="Upload file" onClick={() => toast("Upload simulated")}>📎</div>
            <div className="quick-action" title="Add note" onClick={() => setCommand("Add note: ")}>📝</div>
          </div>
          <input
            type="text"
            value={command}
            onChange={e => setCommand(e.target.value)}
            onKeyDown={handleCommandKey}
            placeholder="Ask ESG-Sense anything…"
            className="command-input"
          />
          <button onClick={submitCommand} disabled={!command.trim()} className="soft-btn px-5 py-1.5 text-sm mr-1 disabled:opacity-40">Ask</button>
        </div>
      </div>
    </div>
  );
}

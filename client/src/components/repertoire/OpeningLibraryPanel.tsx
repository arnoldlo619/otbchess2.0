import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronLeft, Loader2, Search, Sparkles } from "lucide-react";

type RepertoireColor = "white" | "black";

type CatalogOpening = {
  id: string;
  slug: string;
  name: string;
  side: RepertoireColor;
  eco: string;
  shortDescription: string | null;
  difficulty: string;
  popularity: number;
  lineCount: number;
  starterFriendly: boolean;
  tags: Array<{ name: string; category: string; slug: string }>;
};

type CatalogLine = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  difficulty: string;
  moveCount: number;
  commonness: number;
  priority: number;
  mustKnow: boolean;
  trapLine: boolean;
  lineType: string;
};

type OpeningDetail = {
  opening: CatalogOpening;
  chapters: Array<{ name: string; lines: CatalogLine[] }>;
  lineCount: number;
};

type OpeningLineDetail = { line: { pgn: string; title: string; eco: string; moveCount: number } };

export function OpeningLibraryPanel({
  repertoireColor,
  isDark,
  onImportLine,
}: {
  repertoireColor: RepertoireColor;
  isDark: boolean;
  onImportLine: (line: { pgn: string; title: string; eco: string; moveCount: number }) => void;
}) {
  const [side, setSide] = useState<RepertoireColor>(repertoireColor);
  const [search, setSearch] = useState("");
  const [openings, setOpenings] = useState<CatalogOpening[]>([]);
  const [selected, setSelected] = useState<OpeningDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [addingLineId, setAddingLineId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setSide(repertoireColor), [repertoireColor]);

  const loadOpenings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ side, sort: "popularity" });
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`/api/openings?${params.toString()}`);
      if (!response.ok) throw new Error("Opening catalog unavailable");
      const data = (await response.json()) as { openings?: CatalogOpening[] };
      setOpenings(data.openings ?? []);
    } catch {
      setOpenings([]);
      setError("The opening library is temporarily unavailable. Your saved repertoire is unchanged.");
    } finally {
      setLoading(false);
    }
  }, [search, side]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadOpenings(), 180);
    return () => window.clearTimeout(timeout);
  }, [loadOpenings]);

  const selectOpening = useCallback(async (opening: CatalogOpening) => {
    setDetailLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/openings/${opening.slug}`);
      if (!response.ok) throw new Error("Opening detail unavailable");
      setSelected((await response.json()) as OpeningDetail);
    } catch {
      setError("This opening could not be loaded. Please try another family.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const addLine = useCallback(async (line: CatalogLine) => {
    if (!selected) return;
    setAddingLineId(line.id);
    try {
      const response = await fetch(`/api/openings/${selected.opening.slug}/lines/${line.slug}`);
      if (!response.ok) throw new Error("Opening line unavailable");
      const detail = (await response.json()) as OpeningLineDetail;
      if (!detail.line?.pgn) throw new Error("Opening line is missing moves");
      onImportLine(detail.line);
    } catch {
      setError("This line could not be added. Your repertoire remains unchanged.");
    } finally {
      setAddingLineId(null);
    }
  }, [onImportLine, selected]);

  const totalLines = useMemo(() => openings.reduce((total, opening) => total + opening.lineCount, 0), [openings]);
  const colors = isDark
    ? { muted: "text-white/45", border: "border-white/10", panel: "bg-white/[0.025]", card: "bg-white/[0.035] hover:bg-emerald-500/10", active: "bg-emerald-500/15 border-emerald-400/35" }
    : { muted: "text-[#436850]", border: "border-[#ADBC9F]/70", panel: "bg-[#FBFADA]/45", card: "bg-white/65 hover:bg-emerald-50", active: "bg-emerald-50 border-emerald-400/45" };

  if (selected) {
    return (
      <div className="px-3 pb-4 max-h-[66vh] overflow-y-auto">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className={`mt-3 inline-flex items-center gap-1 text-xs font-medium ${colors.muted} hover:text-emerald-500`}
        >
          <ChevronLeft size={14} /> All opening families
        </button>

        <div className={`mt-3 rounded-xl border p-3 ${colors.border} ${colors.panel}`}>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm truncate">{selected.opening.name}</h3>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500">{selected.opening.eco}</span>
              </div>
              <p className={`mt-1 text-xs leading-relaxed ${colors.muted}`}>{selected.opening.shortDescription}</p>
            </div>
            <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-white/10 text-white/60" : "bg-[#ADBC9F]/50 text-[#436850]"}`}>{selected.lineCount} lines</span>
          </div>
        </div>

        {detailLoading ? (
          <div className={`py-12 flex flex-col items-center gap-2 ${colors.muted}`}><Loader2 className="animate-spin" size={20} /><span className="text-xs">Loading curated lines…</span></div>
        ) : selected.chapters.map((chapter) => (
          <section key={chapter.name} className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className={`text-xs font-semibold uppercase tracking-[0.12em] ${colors.muted}`}>{chapter.name}</h4>
              <span className={`text-[10px] ${colors.muted}`}>{chapter.lines.length} lines</span>
            </div>
            <div className="space-y-2">
              {chapter.lines.map((line) => (
                <div key={line.id} className={`rounded-xl border p-3 transition-colors ${colors.border} ${colors.card}`}>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h5 className="text-xs font-semibold leading-snug">{line.title}</h5>
                        {line.mustKnow && <span className="text-[9px] font-bold uppercase tracking-wide text-amber-500">Must know</span>}
                        {line.trapLine && <span className="text-[9px] font-bold uppercase tracking-wide text-rose-500">Trap</span>}
                      </div>
                      <p className={`mt-1 text-[11px] leading-relaxed ${colors.muted}`}>{line.description || `${line.moveCount} half-moves · ${line.difficulty}`}</p>
                      <div className={`mt-2 flex items-center gap-2 text-[10px] ${colors.muted}`}>
                        <span>{line.moveCount} ply</span><span>·</span><span>{line.commonness}% practical</span><span>·</span><span className="capitalize">{line.lineType}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void addLine(line)}
                      disabled={addingLineId === line.id}
                      className="self-start shrink-0 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {addingLineId === line.id ? <Loader2 size={12} className="animate-spin" /> : <BookOpen size={12} />} Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="px-3 pb-4 max-h-[66vh] overflow-y-auto">
      <div className="pt-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-1.5"><Sparkles size={14} className="text-emerald-500" /> Curated opening library</h3>
          <p className={`mt-0.5 text-[11px] ${colors.muted}`}>Merge published main lines, sidesteps, and traps into this tree.</p>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-full ${isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-700"}`}>{openings.length} families · {totalLines} lines</span>
      </div>

      <div className={`mt-3 flex items-center gap-2 rounded-lg border px-2.5 py-2 ${colors.border} ${colors.panel}`}>
        <Search size={14} className={colors.muted} />
        <input aria-label="Search opening library" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search opening or ECO…" className={`min-w-0 flex-1 bg-transparent text-xs outline-none ${isDark ? "placeholder:text-white/25" : "placeholder:text-[#436850]/50"}`} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {(["white", "black"] as const).map((candidate) => (
          <button key={candidate} type="button" onClick={() => setSide(candidate)} className={`rounded-lg px-2 py-1.5 text-xs font-semibold capitalize border transition-colors ${side === candidate ? colors.active : `${colors.border} ${colors.muted}`}`}>{candidate} repertoire</button>
        ))}
      </div>

      {error && <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">{error}</p>}

      {loading ? (
        <div className={`py-12 flex flex-col items-center gap-2 ${colors.muted}`}><Loader2 className="animate-spin" size={20} /><span className="text-xs">Loading opening families…</span></div>
      ) : openings.length === 0 ? (
        <div className={`py-10 text-center ${colors.muted}`}><BookOpen className="mx-auto mb-2 opacity-50" size={22} /><p className="text-xs">No published openings match this search.</p></div>
      ) : (
        <div className="mt-3 space-y-2">
          {openings.map((opening) => (
            <button key={opening.id} type="button" onClick={() => void selectOpening(opening)} className={`w-full rounded-xl border p-3 text-left transition-colors ${colors.border} ${colors.card}`}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><h4 className="text-sm font-semibold truncate">{opening.name}</h4><span className="font-mono text-[10px] text-emerald-500">{opening.eco}</span></div>
                  <p className={`mt-1 text-[11px] leading-relaxed line-clamp-2 ${colors.muted}`}>{opening.shortDescription}</p>
                  <div className={`mt-2 flex items-center gap-2 text-[10px] ${colors.muted}`}><span>{opening.lineCount} curated lines</span><span>·</span><span className="capitalize">{opening.difficulty}</span>{opening.starterFriendly && <><span>·</span><span className="text-emerald-500 font-semibold">Start here</span></>}</div>
                </div>
                <ChevronLeft size={15} className="mt-1 rotate-180 text-emerald-500" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

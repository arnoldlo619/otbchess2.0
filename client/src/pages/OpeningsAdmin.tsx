/**
 * OpeningsAdmin — Internal admin dashboard for managing the openings database.
 *
 * Features:
 *   - Opening catalog manager (list, create, edit, delete)
 *   - Line manager per opening (list, create, edit, delete, reorder)
 *   - PGN import with auto node-tree generation
 *   - QA dashboard (stats, incomplete lines, duplicate detection)
 *   - Bulk publish/unpublish workflow
 *   - Tag management
 *   - Line validation (move legality, FEN integrity)
 *
 * Access: Requires authenticated user + admin (OWNER_OPEN_ID match on server).
 * The client-side gate uses the archive admin password as a lightweight lock.
 */

import { useState, useEffect, useCallback } from "react";
import { useAuthContext } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  BookOpen,
  Plus,
  Trash2,
  Edit3,
  CheckCircle,
  AlertTriangle,
  Upload,
  BarChart3,
  Tag,
  Eye,
  EyeOff,
  Shield,
  Copy,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  Search,
  Lock,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Opening {
  id: string;
  name: string;
  slug: string;
  color: string;
  eco: string;
  difficulty: string;
  isFeatured: number;
  starterFriendly: number;
  isPublished: number;
  createdAt: string;
  lineStats: { total: number; published: number; draft: number };
}

interface OpeningDetail {
  id: string;
  name: string;
  slug: string;
  color: string;
  eco: string;
  startingMoves: string;
  startingFen: string;
  description: string | null;
  summary: string | null;
  difficulty: string;
  popularity: number;
  playCharacter: string;
  themes: string | null;
  lineCount: number;
  sortOrder: number;
  isPublished: number;
  isFeatured: number;
  starterFriendly: number;
  estimatedLineCount: number;
  trapPotential: number;
  strategicComplexity: number;
}

interface Line {
  id: string;
  title: string;
  slug: string;
  eco: string;
  pgn: string;
  finalFen: string;
  plyCount: number;
  description: string | null;
  difficulty: string;
  commonness: number;
  priority: number;
  isMustKnow: number;
  isTrap: number;
  lineType: string;
  color: string;
  strategicSummary: string | null;
  hintText: string | null;
  punishmentIdea: string | null;
  isPublished: number;
  sortOrder: number;
  _qa: { complete: boolean; missing: string[] };
}

interface TagItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
}

interface QAStats {
  openings: number;
  lines: { total: number; published: number; draft: number };
  nodes: number;
  tags: number;
  incompleteLines: number;
}

interface Duplicate {
  lineA: string;
  lineB: string;
  reason: string;
}

interface ValidationResult {
  valid: boolean;
  issues: string[];
  completeness: { complete: boolean; missing: string[] };
}

// ─── API helpers ────────────────────────────────────────────────────────────

async function adminFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Request failed");
  return data as T;
}

// ─── Admin Password Gate ────────────────────────────────────────────────────

const ADMIN_SESSION_KEY = "otb_openings_admin_unlocked";
const CORRECT_PASSWORD = import.meta.env.VITE_ARCHIVE_ADMIN_PASSWORD as string | undefined;

function AdminGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const [unlocked, setUnlocked] = useState(() => {
    try { return sessionStorage.getItem(ADMIN_SESSION_KEY) === "1"; } catch { return false; }
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1a0f]">
        <Card className="w-96 bg-[#1a2e1c] border-[#2a4a2e]">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 text-[#3D6B47] mx-auto mb-4" />
            <p className="text-gray-300">Please sign in to access the admin panel.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1a0f]">
        <Card className="w-96 bg-[#1a2e1c] border-[#2a4a2e]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#3D6B47]" />
              Openings Admin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (CORRECT_PASSWORD && password === CORRECT_PASSWORD) {
                try { sessionStorage.setItem(ADMIN_SESSION_KEY, "1"); } catch { /* ignore */ }
                setUnlocked(true);
              } else {
                setError("Incorrect password");
              }
            }}>
              <Input
                type="password"
                placeholder="Admin password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                className="bg-[#0d1a0f] border-[#2a4a2e] text-white mb-3"
              />
              {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
              <Button type="submit" className="w-full bg-[#3D6B47] hover:bg-[#4a7d54] text-white">
                Unlock
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function OpeningsAdmin() {
  return (
    <AdminGate>
      <AdminDashboard />
    </AdminGate>
  );
}

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("openings");
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#0d1a0f] text-white">
      {/* Header */}
      <div className="border-b border-[#2a4a2e] bg-[#1a2e1c]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-[#3D6B47]" />
            <h1 className="text-lg font-semibold">Openings Admin</h1>
            <Badge variant="outline" className="border-[#3D6B47] text-[#3D6B47] text-xs">Internal</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { window.location.href = "/"; }}
            className="text-gray-400 hover:text-white"
          >
            Back to Site
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {selectedOpeningId ? (
          <OpeningDetail
            openingId={selectedOpeningId}
            onBack={() => setSelectedOpeningId(null)}
          />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-[#1a2e1c] border border-[#2a4a2e] mb-6">
              <TabsTrigger value="openings" className="data-[state=active]:bg-[#3D6B47]">
                <BookOpen className="w-4 h-4 mr-1.5" /> Openings
              </TabsTrigger>
              <TabsTrigger value="qa" className="data-[state=active]:bg-[#3D6B47]">
                <BarChart3 className="w-4 h-4 mr-1.5" /> QA Dashboard
              </TabsTrigger>
              <TabsTrigger value="tags" className="data-[state=active]:bg-[#3D6B47]">
                <Tag className="w-4 h-4 mr-1.5" /> Tags
              </TabsTrigger>
              <TabsTrigger value="import" className="data-[state=active]:bg-[#3D6B47]">
                <Upload className="w-4 h-4 mr-1.5" /> PGN Import
              </TabsTrigger>
            </TabsList>

            <TabsContent value="openings">
              <OpeningsManager onSelectOpening={setSelectedOpeningId} />
            </TabsContent>
            <TabsContent value="qa">
              <QADashboard />
            </TabsContent>
            <TabsContent value="tags">
              <TagManager />
            </TabsContent>
            <TabsContent value="import">
              <PGNImporter />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

// ─── Openings Manager ───────────────────────────────────────────────────────

function OpeningsManager({ onSelectOpening }: { onSelectOpening: (id: string) => void }) {
  const [openingsList, setOpeningsList] = useState<Opening[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const fetchOpenings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{ openings: Opening[] }>("/api/admin/openings");
      setOpeningsList(data.openings);
    } catch (err) {
      console.error("Failed to fetch openings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOpenings(); }, [fetchOpenings]);

  const filtered = openingsList.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.eco.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search openings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-[#1a2e1c] border-[#2a4a2e] text-white"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchOpenings} className="border-[#2a4a2e] text-gray-300">
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)} className="bg-[#3D6B47] hover:bg-[#4a7d54]">
            <Plus className="w-4 h-4 mr-1.5" /> New Opening
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading openings...</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((o) => (
            <Card
              key={o.id}
              className="bg-[#1a2e1c] border-[#2a4a2e] hover:border-[#3D6B47] transition-colors cursor-pointer"
              onClick={() => onSelectOpening(o.id)}
            >
              <CardContent className="py-4 px-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white">{o.name}</span>
                      <Badge variant="outline" className="text-xs border-gray-600 text-gray-400">{o.eco}</Badge>
                      <Badge variant="outline" className={`text-xs ${o.color === "white" ? "border-gray-300 text-gray-300" : "border-gray-500 text-gray-500"}`}>
                        {o.color}
                      </Badge>
                      {o.isFeatured === 1 && <Badge className="bg-amber-600/20 text-amber-400 text-xs">Featured</Badge>}
                      {o.isPublished === 1 ? (
                        <Badge className="bg-green-600/20 text-green-400 text-xs"><Eye className="w-3 h-3 mr-1" />Published</Badge>
                      ) : (
                        <Badge className="bg-gray-600/20 text-gray-400 text-xs"><EyeOff className="w-3 h-3 mr-1" />Draft</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{o.lineStats.total} lines</span>
                      <span className="text-green-500">{o.lineStats.published} published</span>
                      <span className="text-amber-500">{o.lineStats.draft} draft</span>
                      <span>{o.difficulty}</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-500">No openings found.</div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateOpeningDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchOpenings(); }}
        />
      )}
    </div>
  );
}

// ─── Create Opening Dialog ──────────────────────────────────────────────────

function CreateOpeningDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "", color: "white", eco: "", startingMoves: "",
    summary: "", difficulty: "intermediate",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setSaving(true);
    setError("");
    try {
      await adminFetch("/api/admin/openings", {
        method: "POST",
        body: JSON.stringify(form),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#1a2e1c] border-[#2a4a2e] text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Opening</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-gray-300">Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Sicilian Defense" className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-300">Color</Label>
              <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v })}>
                <SelectTrigger className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a2e1c] border-[#2a4a2e]">
                  <SelectItem value="white">White</SelectItem>
                  <SelectItem value="black">Black</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-300">ECO Code</Label>
              <Input value={form.eco} onChange={(e) => setForm({ ...form, eco: e.target.value })}
                placeholder="e.g. B20" className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-gray-300">Starting Moves</Label>
            <Input value={form.startingMoves} onChange={(e) => setForm({ ...form, startingMoves: e.target.value })}
              placeholder="e.g. 1.e4 c5" className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-300">Summary</Label>
            <Input value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder="One-line description" className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-300">Difficulty</Label>
            <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
              <SelectTrigger className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2e1c] border-[#2a4a2e]">
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
                <SelectItem value="expert">Expert</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-gray-400">Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-[#3D6B47] hover:bg-[#4a7d54]">
            {saving ? "Creating..." : "Create Opening"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Opening Detail (Lines Manager) ─────────────────────────────────────────

function OpeningDetail({ openingId, onBack }: { openingId: string; onBack: () => void }) {
  const [opening, setOpening] = useState<OpeningDetail | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateLine, setShowCreateLine] = useState(false);
  const [editingLine, setEditingLine] = useState<Line | null>(null);
  const [validationResult, setValidationResult] = useState<{ lineId: string; result: ValidationResult } | null>(null);
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const [openingData, linesData] = await Promise.all([
        adminFetch<{ opening: OpeningDetail }>(`/api/admin/openings/${openingId}`),
        adminFetch<{ lines: Line[] }>(`/api/admin/openings/${openingId}/lines`),
      ]);
      setOpening(openingData.opening);
      setLines(linesData.lines);
    } catch (err) {
      console.error("Failed to fetch opening detail:", err);
    } finally {
      setLoading(false);
    }
  }, [openingId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleValidate = async (lineId: string) => {
    try {
      const result = await adminFetch<ValidationResult>(`/api/admin/lines/${lineId}/validate`, { method: "POST" });
      setValidationResult({ lineId, result });
    } catch (err) {
      console.error("Validation failed:", err);
    }
  };

  const handleDeleteLine = async (lineId: string) => {
    if (!confirm("Delete this line? This cannot be undone.")) return;
    try {
      await adminFetch(`/api/admin/lines/${lineId}`, { method: "DELETE" });
      fetchDetail();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleBulkPublish = async (publish: boolean) => {
    if (selectedLines.size === 0) return;
    try {
      await adminFetch("/api/admin/lines/bulk-publish", {
        method: "POST",
        body: JSON.stringify({ lineIds: Array.from(selectedLines), publish }),
      });
      setSelectedLines(new Set());
      fetchDetail();
    } catch (err) {
      console.error("Bulk publish failed:", err);
    }
  };

  const toggleLineSelection = (lineId: string) => {
    setSelectedLines((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedLines.size === lines.length) {
      setSelectedLines(new Set());
    } else {
      setSelectedLines(new Set(lines.map((l) => l.id)));
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-400 hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h2 className="text-xl font-semibold">{opening?.name}</h2>
        <Badge variant="outline" className="border-gray-600 text-gray-400">{opening?.eco}</Badge>
        {opening?.isPublished === 1 ? (
          <Badge className="bg-green-600/20 text-green-400 text-xs">Published</Badge>
        ) : (
          <Badge className="bg-gray-600/20 text-gray-400 text-xs">Draft</Badge>
        )}
      </div>

      {/* Opening Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <Card className="bg-[#1a2e1c] border-[#2a4a2e]">
          <CardContent className="py-3 px-4">
            <div className="text-2xl font-bold text-white">{lines.length}</div>
            <div className="text-xs text-gray-500">Total Lines</div>
          </CardContent>
        </Card>
        <Card className="bg-[#1a2e1c] border-[#2a4a2e]">
          <CardContent className="py-3 px-4">
            <div className="text-2xl font-bold text-green-400">{lines.filter((l) => l.isPublished === 1).length}</div>
            <div className="text-xs text-gray-500">Published</div>
          </CardContent>
        </Card>
        <Card className="bg-[#1a2e1c] border-[#2a4a2e]">
          <CardContent className="py-3 px-4">
            <div className="text-2xl font-bold text-amber-400">{lines.filter((l) => !l._qa.complete).length}</div>
            <div className="text-xs text-gray-500">Incomplete</div>
          </CardContent>
        </Card>
        <Card className="bg-[#1a2e1c] border-[#2a4a2e]">
          <CardContent className="py-3 px-4">
            <div className="text-2xl font-bold text-sky-400">{lines.filter((l) => l.isTrap === 1).length}</div>
            <div className="text-xs text-gray-500">Trap Lines</div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedLines.size === lines.length && lines.length > 0}
              onChange={toggleAll}
              className="rounded border-gray-600"
            />
            Select all
          </label>
          {selectedLines.size > 0 && (
            <>
              <span className="text-sm text-gray-500">{selectedLines.size} selected</span>
              <Button size="sm" variant="outline" onClick={() => handleBulkPublish(true)}
                className="border-green-600 text-green-400 hover:bg-green-600/10">
                <Eye className="w-3 h-3 mr-1" /> Publish
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkPublish(false)}
                className="border-gray-600 text-gray-400 hover:bg-gray-600/10">
                <EyeOff className="w-3 h-3 mr-1" /> Unpublish
              </Button>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDetail} className="border-[#2a4a2e] text-gray-300">
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreateLine(true)} className="bg-[#3D6B47] hover:bg-[#4a7d54]">
            <Plus className="w-4 h-4 mr-1.5" /> New Line
          </Button>
        </div>
      </div>

      {/* Lines List */}
      <div className="space-y-2">
        {lines.map((line) => (
          <Card key={line.id} className="bg-[#1a2e1c] border-[#2a4a2e]">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedLines.has(line.id)}
                  onChange={() => toggleLineSelection(line.id)}
                  className="rounded border-gray-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white text-sm truncate">{line.title}</span>
                    <Badge variant="outline" className="text-xs border-gray-600 text-gray-400 shrink-0">{line.eco}</Badge>
                    <Badge variant="outline" className={`text-xs shrink-0 ${
                      line.difficulty === "beginner" ? "border-green-600 text-green-400" :
                      line.difficulty === "intermediate" ? "border-amber-600 text-amber-400" :
                      line.difficulty === "advanced" ? "border-orange-600 text-orange-400" :
                      "border-red-600 text-red-400"
                    }`}>{line.difficulty}</Badge>
                    {line.isMustKnow === 1 && <Badge className="bg-purple-600/20 text-purple-400 text-xs shrink-0">Must-Know</Badge>}
                    {line.isTrap === 1 && <Badge className="bg-red-600/20 text-red-400 text-xs shrink-0">Trap</Badge>}
                    {!line._qa.complete && (
                      <Badge className="bg-amber-600/20 text-amber-400 text-xs shrink-0">
                        <AlertTriangle className="w-3 h-3 mr-1" />Incomplete
                      </Badge>
                    )}
                    {line.isPublished === 1 ? (
                      <Badge className="bg-green-600/20 text-green-400 text-xs shrink-0"><Eye className="w-3 h-3 mr-1" />Live</Badge>
                    ) : (
                      <Badge className="bg-gray-600/20 text-gray-400 text-xs shrink-0">Draft</Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 font-mono truncate">{line.pgn}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => handleValidate(line.id)}
                    className="text-gray-400 hover:text-green-400 h-8 w-8 p-0"
                    title="Validate">
                    <CheckCircle className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingLine(line)}
                    className="text-gray-400 hover:text-sky-400 h-8 w-8 p-0"
                    title="Edit">
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => {
                    navigator.clipboard.writeText(line.id);
                  }}
                    className="text-gray-400 hover:text-white h-8 w-8 p-0"
                    title="Copy ID">
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteLine(line.id)}
                    className="text-gray-400 hover:text-red-400 h-8 w-8 p-0"
                    title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {lines.length === 0 && (
          <div className="text-center py-12 text-gray-500">No lines yet. Create one or import PGN.</div>
        )}
      </div>

      {/* Validation Result Dialog */}
      {validationResult && (
        <Dialog open onOpenChange={() => setValidationResult(null)}>
          <DialogContent className="bg-[#1a2e1c] border-[#2a4a2e] text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {validationResult.result.valid ? (
                  <><CheckCircle className="w-5 h-5 text-green-400" /> Validation Passed</>
                ) : (
                  <><AlertTriangle className="w-5 h-5 text-red-400" /> Validation Issues</>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {validationResult.result.issues.length > 0 && (
                <div>
                  <Label className="text-gray-300 text-sm">Issues:</Label>
                  <ul className="mt-1 space-y-1">
                    {validationResult.result.issues.map((issue, i) => (
                      <li key={i} className="text-red-400 text-sm flex items-start gap-2">
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!validationResult.result.completeness.complete && (
                <div>
                  <Label className="text-gray-300 text-sm">Missing fields:</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {validationResult.result.completeness.missing.map((f) => (
                      <Badge key={f} variant="outline" className="text-xs border-amber-600 text-amber-400">{f}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {validationResult.result.valid && validationResult.result.completeness.complete && (
                <p className="text-green-400 text-sm">All checks passed. Line is ready to publish.</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setValidationResult(null)} className="text-gray-400">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Line Dialog */}
      {showCreateLine && (
        <CreateLineDialog
          openingId={openingId}
          onClose={() => setShowCreateLine(false)}
          onCreated={() => { setShowCreateLine(false); fetchDetail(); }}
        />
      )}

      {/* Edit Line Dialog */}
      {editingLine && (
        <EditLineDialog
          line={editingLine}
          onClose={() => setEditingLine(null)}
          onSaved={() => { setEditingLine(null); fetchDetail(); }}
        />
      )}
    </div>
  );
}

// ─── Create Line Dialog ─────────────────────────────────────────────────────

function CreateLineDialog({ openingId, onClose, onCreated }: { openingId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: "", eco: "", moveSequence: "", difficulty: "intermediate",
    color: "white", description: "", strategicSummary: "", hintText: "",
    punishmentIdea: "", isMustKnow: false, isTrap: false,
    commonness: 50, priority: 50,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setSaving(true);
    setError("");
    try {
      await adminFetch(`/api/admin/openings/${openingId}/lines`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#1a2e1c] border-[#2a4a2e] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Line</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-gray-300">Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Najdorf: 6.Bg5 Main Line" className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-300">Move Sequence (SAN)</Label>
            <Input value={form.moveSequence} onChange={(e) => setForm({ ...form, moveSequence: e.target.value })}
              placeholder="e.g. 1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Bg5"
              className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1 font-mono" />
            <p className="text-xs text-gray-500 mt-1">Moves will be validated for legality. FEN and PGN auto-generated.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-gray-300">ECO</Label>
              <Input value={form.eco} onChange={(e) => setForm({ ...form, eco: e.target.value })}
                placeholder="B90" className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-300">Difficulty</Label>
              <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
                <SelectTrigger className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a2e1c] border-[#2a4a2e]">
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-300">Color</Label>
              <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v })}>
                <SelectTrigger className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a2e1c] border-[#2a4a2e]">
                  <SelectItem value="white">White</SelectItem>
                  <SelectItem value="black">Black</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-gray-300">Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What this line is about..." className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" rows={2} />
          </div>
          <div>
            <Label className="text-gray-300">Strategic Summary</Label>
            <Textarea value={form.strategicSummary} onChange={(e) => setForm({ ...form, strategicSummary: e.target.value })}
              placeholder="Key strategic ideas..." className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" rows={2} />
          </div>
          <div>
            <Label className="text-gray-300">Hint Text</Label>
            <Input value={form.hintText} onChange={(e) => setForm({ ...form, hintText: e.target.value })}
              placeholder="Study hint for the learner" className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-300">Punishment Idea</Label>
            <Input value={form.punishmentIdea} onChange={(e) => setForm({ ...form, punishmentIdea: e.target.value })}
              placeholder="How to punish opponent's mistake" className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-300">Commonness (0-100)</Label>
              <Input type="number" min={0} max={100} value={form.commonness}
                onChange={(e) => setForm({ ...form, commonness: parseInt(e.target.value) || 0 })}
                className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-300">Priority (0-100)</Label>
              <Input type="number" min={0} max={100} value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={form.isMustKnow} onCheckedChange={(v) => setForm({ ...form, isMustKnow: v })} />
              <Label className="text-gray-300">Must-Know</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isTrap} onCheckedChange={(v) => setForm({ ...form, isTrap: v })} />
              <Label className="text-gray-300">Trap Line</Label>
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-gray-400">Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-[#3D6B47] hover:bg-[#4a7d54]">
            {saving ? "Creating..." : "Create Line"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Line Dialog ───────────────────────────────────────────────────────

function EditLineDialog({ line, onClose, onSaved }: { line: Line; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: line.title,
    eco: line.eco,
    difficulty: line.difficulty,
    description: line.description ?? "",
    strategicSummary: line.strategicSummary ?? "",
    hintText: line.hintText ?? "",
    punishmentIdea: line.punishmentIdea ?? "",
    commonness: line.commonness,
    priority: line.priority,
    isMustKnow: line.isMustKnow === 1,
    isTrap: line.isTrap === 1,
    isPublished: line.isPublished === 1,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setSaving(true);
    setError("");
    try {
      await adminFetch(`/api/admin/lines/${line.id}`, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#1a2e1c] border-[#2a4a2e] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Line: {line.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-[#0d1a0f] rounded-lg p-3 border border-[#2a4a2e]">
            <Label className="text-gray-500 text-xs">PGN (read-only)</Label>
            <p className="text-white font-mono text-sm mt-1">{line.pgn}</p>
          </div>
          <div>
            <Label className="text-gray-300">Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-300">ECO</Label>
              <Input value={form.eco} onChange={(e) => setForm({ ...form, eco: e.target.value })}
                className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-300">Difficulty</Label>
              <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
                <SelectTrigger className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a2e1c] border-[#2a4a2e]">
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-gray-300">Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" rows={2} />
          </div>
          <div>
            <Label className="text-gray-300">Strategic Summary</Label>
            <Textarea value={form.strategicSummary} onChange={(e) => setForm({ ...form, strategicSummary: e.target.value })}
              className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" rows={2} />
          </div>
          <div>
            <Label className="text-gray-300">Hint Text</Label>
            <Input value={form.hintText} onChange={(e) => setForm({ ...form, hintText: e.target.value })}
              className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-300">Punishment Idea</Label>
            <Input value={form.punishmentIdea} onChange={(e) => setForm({ ...form, punishmentIdea: e.target.value })}
              className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-300">Commonness (0-100)</Label>
              <Input type="number" min={0} max={100} value={form.commonness}
                onChange={(e) => setForm({ ...form, commonness: parseInt(e.target.value) || 0 })}
                className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-300">Priority (0-100)</Label>
              <Input type="number" min={0} max={100} value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={form.isMustKnow} onCheckedChange={(v) => setForm({ ...form, isMustKnow: v })} />
              <Label className="text-gray-300">Must-Know</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isTrap} onCheckedChange={(v) => setForm({ ...form, isTrap: v })} />
              <Label className="text-gray-300">Trap Line</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isPublished} onCheckedChange={(v) => setForm({ ...form, isPublished: v })} />
              <Label className="text-gray-300">Published</Label>
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-gray-400">Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-[#3D6B47] hover:bg-[#4a7d54]">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── QA Dashboard ───────────────────────────────────────────────────────────

function QADashboard() {
  const [stats, setStats] = useState<QAStats | null>(null);
  const [incomplete, setIncomplete] = useState<Array<{ id: string; title: string; _missing: string[] }>>([]);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQA = useCallback(async () => {
    setLoading(true);
    try {
      const [dashData, incData, dupData] = await Promise.all([
        adminFetch<{ stats: QAStats }>("/api/admin/qa/dashboard"),
        adminFetch<{ lines: Array<{ id: string; title: string; _missing: string[] }> }>("/api/admin/qa/incomplete"),
        adminFetch<{ duplicates: Duplicate[]; count: number }>("/api/admin/qa/duplicates"),
      ]);
      setStats(dashData.stats);
      setIncomplete(incData.lines);
      setDuplicates(dupData.duplicates);
    } catch (err) {
      console.error("QA fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchQA(); }, [fetchQA]);

  if (loading) return <div className="text-center py-12 text-gray-500">Loading QA data...</div>;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-5 gap-3">
        <Card className="bg-[#1a2e1c] border-[#2a4a2e]">
          <CardContent className="py-4 px-5 text-center">
            <div className="text-3xl font-bold text-white">{stats?.openings ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1">Openings</div>
          </CardContent>
        </Card>
        <Card className="bg-[#1a2e1c] border-[#2a4a2e]">
          <CardContent className="py-4 px-5 text-center">
            <div className="text-3xl font-bold text-white">{stats?.lines.total ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1">Total Lines</div>
          </CardContent>
        </Card>
        <Card className="bg-[#1a2e1c] border-[#2a4a2e]">
          <CardContent className="py-4 px-5 text-center">
            <div className="text-3xl font-bold text-green-400">{stats?.lines.published ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1">Published</div>
          </CardContent>
        </Card>
        <Card className="bg-[#1a2e1c] border-[#2a4a2e]">
          <CardContent className="py-4 px-5 text-center">
            <div className="text-3xl font-bold text-white">{stats?.nodes ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1">Nodes</div>
          </CardContent>
        </Card>
        <Card className="bg-[#1a2e1c] border-[#2a4a2e]">
          <CardContent className="py-4 px-5 text-center">
            <div className="text-3xl font-bold text-white">{stats?.tags ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1">Tags</div>
          </CardContent>
        </Card>
      </div>

      {/* Incomplete Lines */}
      <Card className="bg-[#1a2e1c] border-[#2a4a2e]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Incomplete Lines ({incomplete.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {incomplete.length === 0 ? (
            <p className="text-green-400 text-sm">All lines have complete content.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {incomplete.map((line) => (
                <div key={line.id} className="flex items-center justify-between py-2 border-b border-[#2a4a2e] last:border-0">
                  <span className="text-sm text-white">{line.title}</span>
                  <div className="flex gap-1">
                    {line._missing.map((f) => (
                      <Badge key={f} variant="outline" className="text-xs border-amber-600 text-amber-400">{f}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Duplicates */}
      <Card className="bg-[#1a2e1c] border-[#2a4a2e]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <Copy className="w-4 h-4 text-sky-400" />
            Duplicate/Overlapping Lines ({duplicates.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {duplicates.length === 0 ? (
            <p className="text-green-400 text-sm">No duplicates detected.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {duplicates.map((dup, i) => (
                <div key={i} className="py-2 border-b border-[#2a4a2e] last:border-0">
                  <div className="text-sm text-white">{dup.lineA} ↔ {dup.lineB}</div>
                  <div className="text-xs text-amber-400 mt-1">{dup.reason}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tag Manager ────────────────────────────────────────────────────────────

function TagManager() {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState("");

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{ tags: TagItem[] }>("/api/admin/tags");
      setTags(data.tags);
    } catch (err) {
      console.error("Failed to fetch tags:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  const handleDelete = async (tagId: string) => {
    if (!confirm("Delete this tag? It will be removed from all openings and lines.")) return;
    try {
      await adminFetch(`/api/admin/tags/${tagId}`, { method: "DELETE" });
      fetchTags();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const categories = Array.from(new Set(tags.map((t) => t.category))).sort();
  const filtered = tags.filter((t) =>
    t.name.toLowerCase().includes(filter.toLowerCase()) ||
    t.category.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Filter tags..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-10 bg-[#1a2e1c] border-[#2a4a2e] text-white"
          />
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="bg-[#3D6B47] hover:bg-[#4a7d54]">
          <Plus className="w-4 h-4 mr-1.5" /> New Tag
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading tags...</div>
      ) : (
        <div className="space-y-4">
          {categories.map((cat) => {
            const catTags = filtered.filter((t) => t.category === cat);
            if (catTags.length === 0) return null;
            return (
              <Card key={cat} className="bg-[#1a2e1c] border-[#2a4a2e]">
                <CardHeader className="py-3">
                  <CardTitle className="text-white text-sm uppercase tracking-wider">{cat}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2">
                    {catTags.map((tag) => (
                      <div key={tag.id} className="flex items-center gap-1 bg-[#0d1a0f] rounded-full px-3 py-1 border border-[#2a4a2e]">
                        <span className="text-sm text-white">{tag.name}</span>
                        <button onClick={() => handleDelete(tag.id)} className="text-gray-500 hover:text-red-400 ml-1">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateTagDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchTags(); }}
        />
      )}
    </div>
  );
}

function CreateTagDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", category: "theme", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setSaving(true);
    setError("");
    try {
      await adminFetch("/api/admin/tags", { method: "POST", body: JSON.stringify(form) });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#1a2e1c] border-[#2a4a2e] text-white max-w-md">
        <DialogHeader><DialogTitle>Create Tag</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-gray-300">Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Kingside Attack" className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-300">Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1a2e1c] border-[#2a4a2e]">
                <SelectItem value="theme">Theme</SelectItem>
                <SelectItem value="structure">Structure</SelectItem>
                <SelectItem value="style">Style</SelectItem>
                <SelectItem value="level">Level</SelectItem>
                <SelectItem value="bestFor">Best For</SelectItem>
                <SelectItem value="family">Family</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-gray-300">Description</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description" className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-gray-400">Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-[#3D6B47] hover:bg-[#4a7d54]">
            {saving ? "Creating..." : "Create Tag"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── PGN Importer ───────────────────────────────────────────────────────────

function PGNImporter() {
  const [openingsList, setOpeningsList] = useState<Opening[]>([]);
  const [form, setForm] = useState({
    openingId: "", pgn: "", title: "", eco: "",
    difficulty: "intermediate", color: "white",
  });
  const [result, setResult] = useState<{
    lineId: string; slug: string; pgn: string; fen: string; plyCount: number; nodesCreated: number;
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    adminFetch<{ openings: Opening[] }>("/api/admin/openings").then((d) => setOpeningsList(d.openings)).catch(() => {});
  }, []);

  const handleImport = async () => {
    setImporting(true);
    setError("");
    setResult(null);
    try {
      const data = await adminFetch<{
        lineId: string; slug: string; pgn: string; fen: string; plyCount: number; nodesCreated: number;
      }>("/api/admin/import/pgn", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <Card className="bg-[#1a2e1c] border-[#2a4a2e]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#3D6B47]" />
            Import PGN
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-gray-300">Opening</Label>
            <Select value={form.openingId} onValueChange={(v) => setForm({ ...form, openingId: v })}>
              <SelectTrigger className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1"><SelectValue placeholder="Select opening..." /></SelectTrigger>
              <SelectContent className="bg-[#1a2e1c] border-[#2a4a2e] max-h-64">
                {openingsList.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name} ({o.eco})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-gray-300">PGN</Label>
            <Textarea
              value={form.pgn}
              onChange={(e) => setForm({ ...form, pgn: e.target.value })}
              placeholder="Paste PGN here... e.g. 1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6"
              className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1 font-mono"
              rows={4}
            />
          </div>
          <div>
            <Label className="text-gray-300">Line Title (optional)</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Auto-generated from moves if empty" className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-gray-300">ECO</Label>
              <Input value={form.eco} onChange={(e) => setForm({ ...form, eco: e.target.value })}
                placeholder="A00" className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-300">Difficulty</Label>
              <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
                <SelectTrigger className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a2e1c] border-[#2a4a2e]">
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-300">Color</Label>
              <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v })}>
                <SelectTrigger className="bg-[#0d1a0f] border-[#2a4a2e] text-white mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a2e1c] border-[#2a4a2e]">
                  <SelectItem value="white">White</SelectItem>
                  <SelectItem value="black">Black</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {result && (
            <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-green-400 font-medium text-sm">Import Successful</span>
              </div>
              <div className="text-sm text-gray-300 space-y-1">
                <p>Line ID: <code className="text-white">{result.lineId}</code></p>
                <p>PGN: <code className="text-white font-mono">{result.pgn}</code></p>
                <p>Ply count: {result.plyCount} | Nodes created: {result.nodesCreated}</p>
              </div>
            </div>
          )}

          <Button onClick={handleImport} disabled={importing || !form.openingId || !form.pgn}
            className="bg-[#3D6B47] hover:bg-[#4a7d54] w-full">
            {importing ? "Importing..." : "Import PGN & Generate Nodes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// file: frontend/src/views/ProductivityView.tsx
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CheckSquare,
  DollarSign,
  FileText,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
  Users,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../components/Toasts";
import { Button, Card, StatusPill } from "../components/ui";
import { cn } from "../utils/cn";

type SubTab = "notes" | "todos" | "debts" | "warnings";

export const ProductivityView: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<SubTab>("notes");
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [notes, setNotes] = useState<any[]>([]);
  const [todos, setTodos] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [warnings, setWarnings] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [notesRes, todosRes, debtsRes, warningsRes] = await Promise.allSettled([
        api.getNotes(),
        api.getTodos(),
        api.getDebts(),
        api.getWarnings(),
      ]);

      if (notesRes.status === "fulfilled" && notesRes.value?.notes) {
        setNotes(notesRes.value.notes);
      }
      if (todosRes.status === "fulfilled" && todosRes.value?.todos) {
        setTodos(todosRes.value.todos);
      }
      if (debtsRes.status === "fulfilled" && debtsRes.value?.debts) {
        setDebts(debtsRes.value.debts);
      }
      if (warningsRes.status === "fulfilled" && warningsRes.value?.warnings) {
        setWarnings(warningsRes.value.warnings);
      }
    } catch {
      toast("Failed to load some productivity records", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteNote = async (groupJid: string, keyword: string) => {
    try {
      await api.deleteNote(groupJid, keyword);
      setNotes((prev) => prev.filter((n) => !(n.groupId === groupJid && n.keyword === keyword)));
      toast(`Note '${keyword}' deleted`, "success");
    } catch (err: any) {
      toast(err.message || "Failed to delete note", "error");
    }
  };

  const filteredNotes = notes.filter(
    (n) =>
      !searchQuery ||
      n.keyword?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.groupId?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTodos = todos.filter(
    (t) =>
      !searchQuery ||
      t.task?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.userJid?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDebts = debts.filter(
    (d) =>
      !searchQuery ||
      d.person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredWarnings = warnings.filter(
    (w) =>
      !searchQuery ||
      w.userId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.reason?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-main">
            Productivity Suite
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Manage operational group notes, scheduled tasks, debts, and moderation strikes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-0.5 rounded-lg border border-line bg-panel-raised">
          <button
            type="button"
            onClick={() => setActiveTab("notes")}
            className={cn(
              "flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              activeTab === "notes"
                ? "bg-panel text-text-main font-semibold shadow-xs"
                : "text-muted hover:text-text-main"
            )}
          >
            <FileText size={14} className="text-indigo-400" />
            <span>Group Notes</span>
            <span className="rounded px-1.5 py-0.2 text-[10px] font-mono bg-panel-hover text-muted">
              {notes.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("todos")}
            className={cn(
              "flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              activeTab === "todos"
                ? "bg-panel text-text-main font-semibold shadow-xs"
                : "text-muted hover:text-text-main"
            )}
          >
            <CheckSquare size={14} className="text-emerald-400" />
            <span>Tasks & Todos</span>
            <span className="rounded px-1.5 py-0.2 text-[10px] font-mono bg-panel-hover text-muted">
              {todos.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("debts")}
            className={cn(
              "flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              activeTab === "debts"
                ? "bg-panel text-text-main font-semibold shadow-xs"
                : "text-muted hover:text-text-main"
            )}
          >
            <DollarSign size={14} className="text-amber-400" />
            <span>Debts Ledger</span>
            <span className="rounded px-1.5 py-0.2 text-[10px] font-mono bg-panel-hover text-muted">
              {debts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("warnings")}
            className={cn(
              "flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              activeTab === "warnings"
                ? "bg-panel text-text-main font-semibold shadow-xs"
                : "text-muted hover:text-text-main"
            )}
          >
            <AlertTriangle size={14} className="text-rose-400" />
            <span>Moderation Strikes</span>
            <span className="rounded px-1.5 py-0.2 text-[10px] font-mono bg-panel-hover text-muted">
              {warnings.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search records..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-line bg-panel text-text-main placeholder:text-muted focus:outline-hidden focus:border-indigo-500"
          />
        </div>
      </div>

      {/* ── Content Panes ── */}
      {loading ? (
        <Card className="flex flex-col items-center justify-center p-12 text-muted text-xs">
          <RefreshCw size={24} className="animate-spin text-indigo-400 mb-2" />
          <span>Loading stored productivity records...</span>
        </Card>
      ) : (
        <>
          {/* Notes View */}
          {activeTab === "notes" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNotes.length === 0 ? (
                <Card className="col-span-full p-8 text-center text-muted text-xs">
                  No notes saved yet. Create notes in groups using the <code className="text-indigo-400">!note add &lt;keyword&gt; &lt;text&gt;</code> command.
                </Card>
              ) : (
                filteredNotes.map((note, idx) => (
                  <Card key={`${note.groupId}_${note.keyword}_${idx}`} className="p-4 flex flex-col justify-between border-line bg-panel hover:border-line-hover transition-colors">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono font-bold text-sm text-indigo-400">
                          #{note.keyword}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.groupId, note.keyword)}
                          className="text-muted hover:text-rose-400 transition-colors p-1"
                          title="Delete note"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <p className="text-xs text-text-main whitespace-pre-wrap line-clamp-4 leading-relaxed mb-3">
                        {note.content}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-line/60 flex items-center justify-between text-[10px] text-muted font-mono">
                      <span className="truncate max-w-[140px]">{note.groupId?.replace(/@.*$/, "")}</span>
                      <span>{note.createdAt ? new Date(note.createdAt).toLocaleDateString() : "Saved"}</span>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Todos View */}
          {activeTab === "todos" && (
            <div className="flex flex-col gap-2">
              {filteredTodos.length === 0 ? (
                <Card className="p-8 text-center text-muted text-xs">
                  No active todo items. Add tasks in chat with <code className="text-emerald-400">!todo add &lt;task&gt;</code>.
                </Card>
              ) : (
                filteredTodos.map((todo, idx) => (
                  <Card key={todo.id || idx} className="p-3.5 flex items-center justify-between gap-3 border-line bg-panel">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-2 rounded-full bg-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-text-main truncate">
                          {todo.task || todo.text || "Untitled task"}
                        </p>
                        <p className="text-[10px] text-muted font-mono mt-0.5">
                          Owner: {todo.userJid?.replace(/@.*$/, "") || "User"}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-muted shrink-0">
                      {todo.createdAt ? new Date(todo.createdAt).toLocaleDateString() : ""}
                    </span>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Debts View */}
          {activeTab === "debts" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDebts.length === 0 ? (
                <Card className="col-span-full p-8 text-center text-muted text-xs">
                  No debts recorded. Manage debts with <code className="text-amber-400">!debt add &lt;person&gt; &lt;amount&gt;</code>.
                </Card>
              ) : (
                filteredDebts.map((debt, idx) => (
                  <Card key={debt.id || idx} className="p-4 border-line bg-panel flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-xs text-text-main truncate">
                          {debt.person}
                        </span>
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold",
                          debt.settled ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                        )}>
                          {debt.settled ? "SETTLED" : "PENDING"}
                        </span>
                      </div>
                      <div className="text-lg font-mono font-bold text-text-main mb-1">
                        ${debt.amount || 0}
                      </div>
                      {debt.description && (
                        <p className="text-xs text-muted leading-relaxed line-clamp-2">
                          {debt.description}
                        </p>
                      )}
                    </div>
                    <div className="pt-2 mt-3 border-t border-line/60 text-[10px] text-muted font-mono">
                      {debt.createdAt ? new Date(debt.createdAt).toLocaleDateString() : ""}
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Warnings View */}
          {activeTab === "warnings" && (
            <div className="flex flex-col gap-2">
              {filteredWarnings.length === 0 ? (
                <Card className="p-8 text-center text-muted text-xs">
                  No active warnings or strikes. Group strikes are issued with <code className="text-rose-400">!warn @user &lt;reason&gt;</code>.
                </Card>
              ) : (
                filteredWarnings.map((warn, idx) => (
                  <Card key={warn.id || idx} className="p-3.5 flex items-center justify-between gap-3 border-line bg-panel">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-7 items-center justify-center rounded-md bg-rose-500/10 text-rose-400 shrink-0 font-mono font-bold text-xs">
                        {warn.count || 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-text-main truncate">
                          Member: {warn.userId?.replace(/@.*$/, "")}
                        </p>
                        <p className="text-[10px] text-muted mt-0.5 truncate">
                          Reason: {warn.reason || "Rule violation"}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-muted shrink-0">
                      Group: {warn.groupId?.replace(/@.*$/, "")}
                    </span>
                  </Card>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

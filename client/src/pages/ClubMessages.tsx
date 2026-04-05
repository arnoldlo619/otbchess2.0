/**
 * ClubMessages — /clubs/:clubId/messages
 *
 * Direct messaging between club members, with turn-based chess games.
 * Layout: left sidebar (conversation list) + right panel (chat + chess board).
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import {
  ChevronLeft,
  Send,
  Swords,
  MessageSquare,
  Check,
  X,
  Loader2,
  Crown,
  Users,
} from "lucide-react";
import { NavLogo } from "@/components/NavLogo";
import { useAuthContext } from "@/context/AuthContext";
import { getClub, getClubMembers } from "@/lib/clubRegistry";

// ── Types ─────────────────────────────────────────────────────────────────────
interface OtherUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  chesscomUsername: string | null;
}

interface ChessGame {
  id: string;
  conversationId: string;
  whiteId: string;
  blackId: string;
  status: "pending" | "active" | "completed" | "declined";
  pgn: string | null;
  currentFen: string | null;
  turn: "white" | "black";
  result: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: "text" | "chess_invite" | "chess_move";
  body: string | null;
  chessGameId: string | null;
  chessGame: ChessGame | null;
  createdAt: string;
}

interface Conversation {
  id: string;
  clubId: string;
  userAId: string;
  userBId: string;
  lastMessageAt: string;
  otherUser: OtherUser | null;
  lastMessage: { body: string | null; type: string; senderId: string; createdAt: string } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ user, size = 40 }: { user: OtherUser | null; size?: number }) {
  if (!user) return <div className="rounded-full bg-white/10" style={{ width: size, height: size }} />;
  const cls = `rounded-full object-cover flex-shrink-0 flex items-center justify-center font-bold text-white bg-[#2d6a4f]`;
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt={user.displayName} className={`rounded-full object-cover flex-shrink-0`} style={{ width: size, height: size }} />;
  }
  return (
    <div className={cls} style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {initials(user.displayName)}
    </div>
  );
}

// ── Chess Game Card ───────────────────────────────────────────────────────────
function ChessGameCard({
  game,
  message,
  currentUserId,
  onAccept,
  onDecline,
  onMove,
}: {
  game: ChessGame;
  message: Message;
  currentUserId: string;
  onAccept: (gameId: string) => void;
  onDecline: (gameId: string) => void;
  onMove: (gameId: string, from: string, to: string, promotion?: string) => void;
}) {
  const isWhite = game.whiteId === currentUserId;
  const isMyTurn = (game.turn === "white" && isWhite) || (game.turn === "black" && !isWhite);
  const fen = game.currentFen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  const chess = new Chess(fen);
  const isInCheck = chess.inCheck();

  function onDrop({ piece, sourceSquare, targetSquare }: { piece: { pieceType: string; position: string; isSparePiece: boolean }; sourceSquare: string; targetSquare: string | null }) {
    if (!isMyTurn || game.status !== "active" || !targetSquare) return false;
    const pt = piece.pieceType; // e.g. 'wP', 'bQ'
    const isPromotion =
      pt[1] === "P" &&
      ((pt[0] === "w" && targetSquare[1] === "8") || (pt[0] === "b" && targetSquare[1] === "1"));
    onMove(game.id, sourceSquare, targetSquare, isPromotion ? "q" : undefined);
    return true;
  }

  const statusLabel =
    game.status === "pending"
      ? "Waiting for response"
      : game.status === "declined"
      ? "Declined"
      : game.status === "completed"
      ? game.result?.replace("_", " ") ?? "Game over"
      : isMyTurn
      ? "Your turn"
      : "Opponent's turn";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden max-w-[320px] w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-2">
          <Swords className="w-3.5 h-3.5 text-[#4ade80]" />
          <span className="text-xs font-semibold text-white/80">Chess Game</span>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            game.status === "active" && isMyTurn
              ? "bg-[#4ade80]/20 text-[#4ade80]"
              : game.status === "completed"
              ? "bg-amber-400/20 text-amber-400"
              : "bg-white/10 text-white/50"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Board */}
      {game.status !== "pending" && game.status !== "declined" && (
        <div className="p-2">
          <Chessboard
            options={{
              position: fen,
              boardOrientation: isWhite ? "white" : "black",
              allowDragging: isMyTurn && game.status === "active",
              onPieceDrop: onDrop,
              boardStyle: { borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" },
              darkSquareStyle: { backgroundColor: "#2d6a4f" },
              lightSquareStyle: { backgroundColor: "#d4edda" },
            }}
          />
          {isInCheck && game.status === "active" && (
            <p className="text-center text-xs text-red-400 font-semibold mt-1">Check!</p>
          )}
        </div>
      )}

      {/* Accept / Decline buttons for pending invite */}
      {game.status === "pending" && game.blackId === currentUserId && (
        <div className="flex gap-2 p-3">
          <button
            onClick={() => onAccept(game.id)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#2d6a4f] hover:bg-[#245a41] text-white text-xs font-semibold py-2 transition"
          >
            <Check className="w-3.5 h-3.5" /> Accept
          </button>
          <button
            onClick={() => onDecline(game.id)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 text-xs font-semibold py-2 transition"
          >
            <X className="w-3.5 h-3.5" /> Decline
          </button>
        </div>
      )}

      {game.status === "pending" && game.whiteId === currentUserId && (
        <p className="text-center text-xs text-white/40 py-3">Waiting for opponent to accept…</p>
      )}

      {game.status === "declined" && (
        <p className="text-center text-xs text-red-400/70 py-3">Game was declined.</p>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ClubMessages() {
  const { clubId } = useParams<{ clubId: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuthContext();

  const club = clubId ? getClub(clubId) : null;
  const members = clubId ? getClubMembers(clubId) : [];

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;

  // ── Load conversations ──────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!clubId || !user) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/conversations`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } catch { /* silent */ }
  }, [clubId, user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    loadConversations().finally(() => setLoading(false));
  }, [loadConversations, user]);

  // ── Load messages for active conversation ───────────────────────────────────
  const loadMessages = useCallback(async (convId: string) => {
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/conversations/${convId}/messages`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } catch { /* silent */ } finally {
      setMessagesLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    if (!activeConvId) return;
    loadMessages(activeConvId);
    // Poll for new messages every 5 seconds
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => loadMessages(activeConvId), 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeConvId, loadMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Start a new conversation ────────────────────────────────────────────────
  async function startConversation(otherUserId: string) {
    if (!clubId) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/conversations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId }),
      });
      if (res.ok) {
        const data = await res.json();
        await loadConversations();
        setActiveConvId(data.conversation.id);
        setShowNewChat(false);
      }
    } catch { /* silent */ }
  }

  // ── Send a text message ─────────────────────────────────────────────────────
  async function sendMessage() {
    if (!activeConvId || !messageInput.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/conversations/${activeConvId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: messageInput.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setMessageInput("");
        loadConversations();
      }
    } catch { /* silent */ } finally {
      setSending(false);
    }
  }

  // ── Send a chess invite ─────────────────────────────────────────────────────
  async function sendChessInvite() {
    if (!activeConvId) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/conversations/${activeConvId}/chess-invite`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        loadConversations();
      }
    } catch { /* silent */ }
  }

  // ── Respond to chess invite ─────────────────────────────────────────────────
  async function respondToInvite(gameId: string, action: "accept" | "decline") {
    if (!activeConvId) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/conversations/${activeConvId}/chess-games/${gameId}/respond`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        await loadMessages(activeConvId);
      }
    } catch { /* silent */ }
  }

  // ── Make a chess move ───────────────────────────────────────────────────────
  async function makeMove(gameId: string, from: string, to: string, promotion?: string) {
    if (!activeConvId) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/conversations/${activeConvId}/chess-games/${gameId}/move`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, promotion }),
      });
      if (res.ok) {
        await loadMessages(activeConvId);
      }
    } catch { /* silent */ }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0d1f12] flex items-center justify-center">
        <p className="text-white/50">Please sign in to use club messaging.</p>
      </div>
    );
  }

  // Members who are not the current user and not already in a conversation
  const existingOtherIds = new Set(conversations.map((c) => c.otherUser?.id).filter(Boolean));
  const availableMembers = members.filter((m) => m.userId !== user.id && !existingOtherIds.has(m.userId));

  return (
    <div className="min-h-screen bg-[#0d1f12] flex flex-col">
      {/* Nav */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0d1f12]/90 backdrop-blur-sm otb-header-safe">
        <button
          onClick={() => navigate(`/clubs/${clubId}`)}
          className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition"
        >
          <ChevronLeft className="w-4 h-4" />
          {club?.name ?? "Club"}
        </button>
        <NavLogo linked />
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#4ade80]" />
          <span className="text-sm font-semibold text-white">Messages</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar: Conversation List ── */}
        <div className="w-72 flex-shrink-0 border-r border-white/10 flex flex-col bg-[#0d1f12]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-sm font-bold text-white">Conversations</span>
            <button
              onClick={() => setShowNewChat((v) => !v)}
              className="text-xs text-[#4ade80] hover:text-[#22c55e] font-medium transition"
            >
              + New
            </button>
          </div>

          {/* New chat member picker */}
          {showNewChat && (
            <div className="border-b border-white/10 bg-white/5 p-3 space-y-1">
              <p className="text-xs text-white/40 mb-2 font-medium">Start a conversation with:</p>
              {availableMembers.length === 0 ? (
                <p className="text-xs text-white/30">No more members to message.</p>
              ) : (
                availableMembers.map((m) => (
                  <button
                    key={m.userId}
                    onClick={() => startConversation(m.userId)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/10 transition text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#2d6a4f] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {initials(m.displayName)}
                    </div>
                    <span className="text-sm text-white truncate">{m.displayName}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-white/30" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 px-4">
                <Users className="w-8 h-8 text-white/20 mx-auto mb-2" />
                <p className="text-xs text-white/30">No conversations yet.</p>
                <button
                  onClick={() => setShowNewChat(true)}
                  className="mt-2 text-xs text-[#4ade80] hover:underline"
                >
                  Start one →
                </button>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition border-b border-white/5 text-left ${
                    activeConvId === conv.id ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <Avatar user={conv.otherUser} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {conv.otherUser?.displayName ?? "Unknown"}
                    </p>
                    <p className="text-xs text-white/40 truncate">
                      {conv.lastMessage?.type === "chess_invite"
                        ? "♟ Chess invite"
                        : conv.lastMessage?.type === "chess_move"
                        ? "♟ Chess move"
                        : conv.lastMessage?.body ?? "No messages yet"}
                    </p>
                  </div>
                  {conv.lastMessage && (
                    <span className="text-[10px] text-white/30 flex-shrink-0">
                      {timeAgo(conv.lastMessage.createdAt)}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Main: Chat View ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {!activeConvId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
              <MessageSquare className="w-12 h-12 text-white/10" />
              <p className="text-white/30 text-sm">Select a conversation or start a new one.</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-3">
                  <Avatar user={activeConv?.otherUser ?? null} size={36} />
                  <div>
                    <p className="text-sm font-bold text-white">
                      {activeConv?.otherUser?.displayName ?? "Chat"}
                    </p>
                    {activeConv?.otherUser?.chesscomUsername && (
                      <p className="text-xs text-white/40">@{activeConv.otherUser.chesscomUsername}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={sendChessInvite}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2d6a4f]/30 hover:bg-[#2d6a4f]/50 text-[#4ade80] text-xs font-semibold border border-[#4ade80]/20 transition"
                >
                  <Swords className="w-3.5 h-3.5" />
                  Challenge to Chess
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-white/30" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-xs text-white/30">No messages yet. Say hello!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.senderId === user.id;
                    if (msg.type === "chess_invite" || msg.type === "chess_move") {
                      return (
                        <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                          {msg.chessGame ? (
                            <ChessGameCard
                              game={msg.chessGame}
                              message={msg}
                              currentUserId={user.id}
                              onAccept={(gid) => respondToInvite(gid, "accept")}
                              onDecline={(gid) => respondToInvite(gid, "decline")}
                              onMove={makeMove}
                            />
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 border border-white/10">
                              <Crown className="w-4 h-4 text-amber-400" />
                              <span className="text-xs text-white/60">{msg.body}</span>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                            isMe
                              ? "bg-[#2d6a4f] text-white rounded-br-sm"
                              : "bg-white/10 text-white/90 rounded-bl-sm"
                          }`}
                        >
                          {msg.body}
                          <span className={`block text-[10px] mt-0.5 ${isMe ? "text-white/50" : "text-white/30"}`}>
                            {timeAgo(msg.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-5 py-3 border-t border-white/10 bg-[#0d1f12]/80">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Type a message…"
                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#4ade80]/50 transition"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!messageInput.trim() || sending}
                    className="w-10 h-10 rounded-2xl bg-[#2d6a4f] hover:bg-[#245a41] flex items-center justify-center transition disabled:opacity-40"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

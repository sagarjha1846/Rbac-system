import { FormEvent, useEffect, useRef, useState } from "react";

interface Message {
  role: "user" | "assistant";
  text: string;
  actions?: { tool: string; args: Record<string, unknown> }[];
}

export function Chat({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/chat/session", { method: "POST", headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setSessionId(d.sessionId))
      .catch((err) => setError(err.message));
  }, [token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || !sessionId || sending) return;
    const userMessage = input;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: userMessage }]);
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId, message: userMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setMessages((m) => [...m, { role: "assistant", text: data.reply, actions: data.actionsTaken }]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>RBAC Admin Assistant</h2>
        <button onClick={onLogout}>Log out</button>
      </div>
      <div style={{ border: "1px solid #ddd", borderRadius: 8, minHeight: 400, maxHeight: 500, overflowY: "auto", padding: 12 }}>
        {messages.length === 0 && (
          <p style={{ color: "#888" }}>
            Try: "Add Rajesh (rajesh@example.com) with read and add access to the Vendor module, put him in a new
            group called Vendor Manager"
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 12, textAlign: m.role === "user" ? "right" : "left" }}>
            <div
              style={{
                display: "inline-block",
                background: m.role === "user" ? "#2563eb" : "#f1f5f9",
                color: m.role === "user" ? "white" : "black",
                borderRadius: 8,
                padding: "8px 12px",
                maxWidth: "80%",
                whiteSpace: "pre-wrap",
              }}
            >
              {m.text}
            </div>
            {m.actions && m.actions.length > 0 && (
              <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                actions: {m.actions.map((a) => a.tool).join(", ")}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <form onSubmit={submit} style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe what you want to do..."
          style={{ flex: 1, padding: 8 }}
          disabled={!sessionId}
        />
        <button disabled={sending || !sessionId} type="submit">
          Send
        </button>
      </form>
    </div>
  );
}

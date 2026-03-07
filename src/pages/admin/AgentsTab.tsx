// === AgentsTab.tsx ===[code here]

interface AgentsTabProps {
  cardStyle: React.CSSProperties;
  agentEmail: string;
  agentPassword: string;
  agentName: string;
  savingAgent: boolean;
  agentError: string;
  setAgentEmail: (v: string) => void;
  setAgentPassword: (v: string) => void;
  setAgentName: (v: string) => void;
  handleCreateAgent: (e: React.FormEvent) => void;
}

export default function AgentsTab({
  cardStyle,
  agentEmail,
  agentPassword,
  agentName,
  savingAgent,
  agentError,
  setAgentEmail,
  setAgentPassword,
  setAgentName,
  handleCreateAgent,
}: AgentsTabProps) {
  return (
    <section style={cardStyle}>
      <h2 style={{ marginTop: 0, marginBottom: 12 }}>
        🚚 Create Agent
      </h2>

      <form
        onSubmit={handleCreateAgent}
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 2fr 1fr auto",
          gap: 8,
          alignItems: "end",
        }}
      >
        <input
          placeholder="Agent Email"
          value={agentEmail}
          onChange={(e) => setAgentEmail(e.target.value)}
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #d1d5db",
            fontSize: 14,
          }}
        />

        <input
  type="password"
  placeholder="Password"
  value={agentPassword}
          onChange={(e) => setAgentPassword(e.target.value)}
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #d1d5db",
            fontSize: 14,
          }}
        />

        <input
          placeholder="Agent Name"
          value={agentName}
          onChange={(e) => setAgentName(e.target.value)}
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #d1d5db",
            fontSize: 14,
          }}
        />

        <button
          type="submit"
          disabled={savingAgent}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            background: "#2563eb",
            color: "#ffffff",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          {savingAgent ? "Saving..." : "Create"}
        </button>
      </form>

      {agentError && (
        <p style={{ color: "red", marginTop: 8 }}>{agentError}</p>
      )}
    </section>
  );
}
// === AgentsTab.tsx ===[code here]

interface Agent {
  id: string;
  email: string;
  name?: string;
  phone?: string;
}

interface AgentsTabProps {
  cardStyle: React.CSSProperties;
  agentEmail: string;
  agentPassword: string;
  agentName: string;
  agentPhone: string;
  savingAgent: boolean;
  agentError: string;
  agents: Agent[];
  setAgentEmail: (v: string) => void;
  setAgentPassword: (v: string) => void;
  setAgentName: (v: string) => void;
  setAgentPhone: (v: string) => void;
  handleCreateAgent: (e: React.FormEvent) => void;
}

export default function AgentsTab({
  cardStyle,
  agentEmail,
  agentPassword,
  agentName,
  agentPhone,
  savingAgent,
  agentError,
  agents,
  setAgentEmail,
  setAgentPassword,
  setAgentName,
  setAgentPhone,
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
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "flex-end",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 2 }}>
          <label style={{ fontSize: 12, marginBottom: 4, color: "#555" }}>Email</label>
          <input
            placeholder="agent@email.com"
            value={agentEmail}
            onChange={(e) => setAgentEmail(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 2 }}>
          <label style={{ fontSize: 12, marginBottom: 4, color: "#555" }}>Password</label>
          <input
            type="password"
            placeholder="Password"
            value={agentPassword}
            onChange={(e) => setAgentPassword(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 2 }}>
          <label style={{ fontSize: 12, marginBottom: 4, color: "#555" }}>Name</label>
          <input
            placeholder="Agent Name"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <label style={{ fontSize: 12, marginBottom: 4, color: "#555" }}>Phone</label>
          <input
            placeholder="9876543210"
            value={agentPhone}
            onChange={(e) => setAgentPhone(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
          />
        </div>

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
            height: 42,
          }}
        >
          {savingAgent ? "Saving..." : "Create"}
        </button>
      </form>

      {agentError && (
        <p style={{ color: "red", marginTop: 8 }}>{agentError}</p>
      )}

      {/* Agent List */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 12 }}>Existing Agents</h3>
        {agents.length === 0 ? (
          <p style={{ color: "#666", fontSize: 14 }}>No agents added yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ textAlign: "left", padding: 8 }}>Name</th>
                <th style={{ textAlign: "left", padding: 8 }}>Email</th>
                <th style={{ textAlign: "left", padding: 8 }}>Phone</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: 8 }}>{a.name || "—"}</td>
                  <td style={{ padding: 8 }}>{a.email}</td>
                  <td style={{ padding: 8 }}>{a.phone || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
// === DeliveryTab.tsx ===[code here]

interface DeliveryTabProps {
  cardStyle: React.CSSProperties;
  tenantCustomers: any[];
  tenantAgents: any[];
  customerProfileMap: Record<string, { name?: string; phone?: string }>;
  assignmentAgent: Record<string, string>;
  assignmentRoute: Record<string, string>;
  savingAssignmentFor: string | null;
  loadingAssignments: boolean;
  assignmentError: string;
  formatCustomerLabel: (id: string) => string;
  setAssignmentAgent: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  setAssignmentRoute: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  handleSaveAssignment: (id: string) => void;
}

export default function DeliveryTab({
  cardStyle,
  tenantCustomers,
  tenantAgents,
  assignmentAgent,
  assignmentRoute,
  savingAssignmentFor,
  loadingAssignments,
  assignmentError,
  formatCustomerLabel,
  setAssignmentAgent,
  setAssignmentRoute,
  handleSaveAssignment,
}: DeliveryTabProps) {
  return (
    <section style={cardStyle}>
      <h2 style={{ marginTop: 0, marginBottom: 12 }}>
        🗺 Delivery Routes & Customer Assignment
      </h2>

      {assignmentError && (
        <p style={{ color: "red" }}>{assignmentError}</p>
      )}

      {loadingAssignments ? (
        <p>Loading customers and routes...</p>
      ) : tenantCustomers.length === 0 ? (
        <p>No customers found.</p>
      ) : tenantAgents.length === 0 ? (
        <p>No agents found. Create agent accounts first.</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 8 }}>Customer</th>
              <th style={{ textAlign: "left", padding: 8 }}>
                Assigned Agent
              </th>
              <th style={{ textAlign: "left", padding: 8 }}>
                Route / Area
              </th>
              <th style={{ textAlign: "left", padding: 8 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {tenantCustomers.map((c) => (
              <tr key={c.id}>
                <td style={{ padding: 8 }}>
                  {formatCustomerLabel(c.id)}
                </td>

                <td style={{ padding: 8 }}>
                  <select
                    style={{ width: "100%", padding: 6 }}
                    value={assignmentAgent[c.id] ?? ""}
                    onChange={(e) =>
                      setAssignmentAgent((prev) => ({
                     ...prev,
                        [c.id]: e.target.value,
                      }))
                    }
                  >
                    <option value="">-- Select Agent --</option>
                    {tenantAgents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.email}
                      </option>
                    ))}
                  </select>
                </td>

                <td style={{ padding: 8 }}>
                  <input
                    style={{ width: "100%", padding: 6 }}
                    value={assignmentRoute[c.id] ?? ""}
                    onChange={(e) =>
                      setAssignmentRoute((prev) => ({
                        ...prev,
                        [c.id]: e.target.value,
                      }))
                    }
                  />
                </td>

                <td style={{ padding: 8 }}>
                  <button
                    onClick={() => handleSaveAssignment(c.id)}
                    disabled={savingAssignmentFor === c.id}
                  >
                    {savingAssignmentFor === c.id
                      ? "Saving..."
                      : "Save"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
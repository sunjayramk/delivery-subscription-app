// === SubscriptionsTab.tsx === [code here]

interface DeliveryAddress {
  label: string;
  line1: string;
  area?: string;
  city?: string;
  pincode?: string;
  phone?: string;
  mapUrl?: string;
}

interface Subscription {
  id: string;
  productName: string;
  unit: string;
  price: number;
  qty: number;
  scheduleType: string;
  scheduleDays?: number[];
  isActive: boolean;
  dayQuantities?: Record<string, number>;
  skipDates?: string[];
  vacationFrom?: string;
  vacationTo?: string;
  deliveryAddress?: DeliveryAddress;
}

interface Props {
  loadingSubs: boolean;
  errorSubs: string;

  activeSubs: Subscription[];
  pausedSubs: Subscription[];

  vacationFromMap: Record<string, string>;
  vacationToMap: Record<string, string>;

  setVacationFromMap: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;

  setVacationToMap: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;

  toggleSubscriptionActive: (s: Subscription) => void;
  handleSkipTomorrow: (s: Subscription) => void;
  handleSetVacationRange: (
    s: Subscription,
    from: string,
    to: string
  ) => void;

  formatSchedule: (s: Subscription) => string;
  formatQtyPattern: (s: Subscription) => string | null;
  formatAddress: (addr?: DeliveryAddress) => string;
}

export default function SubscriptionsTab({
  loadingSubs,
  errorSubs,
  activeSubs,
  pausedSubs,
  vacationFromMap,
  vacationToMap,
  setVacationFromMap,
  setVacationToMap,
  toggleSubscriptionActive,
  handleSkipTomorrow,
  handleSetVacationRange,
  formatSchedule,
  formatQtyPattern,
  formatAddress,
}: Props) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2>My Subscriptions</h2>

      {loadingSubs ? (
        <p>Loading subscriptions...</p>
      ) : errorSubs ? (
        <p style={{ color: "red" }}>{errorSubs}</p>
      ) : activeSubs.length === 0 && pausedSubs.length === 0 ? (
        <p>You don't have any subscriptions yet.</p>
      ) : (
        <>
          {/* ACTIVE SUBSCRIPTIONS */}
          {activeSubs.length > 0 && (
            <>
              <h3>Active</h3>

              <ul style={{ listStyle: "none", padding: 0 }}>
                {activeSubs.map((s) => {
                  const qtyPattern = formatQtyPattern(s);

                  return (
                    <li
                      key={s.id}
                      style={{
                        padding: 12,
                        border: "1px solid #e0e0e0",
                        borderRadius: 10,
                        marginBottom: 12,
                      }}
                    >
                      <div>
                        <strong>
                          {s.productName} ({s.unit})
                        </strong>
                      </div>

                      <div style={{ fontSize: 14 }}>
                        Base qty: {s.qty} · Schedule: {formatSchedule(s)}
                      </div>

                      <div style={{ fontSize: 13, marginTop: 2 }}>
                        Deliver to: {formatAddress(s.deliveryAddress)}
                      </div>

                      {qtyPattern && (
                        <div
                          style={{
                            fontSize: 12,
                            marginTop: 2,
                            color: "#555",
                          }}
                        >
                          Qty pattern: {qtyPattern}
                        </div>
                      )}

                      {s.vacationFrom && s.vacationTo && (
                        <div
                          style={{
                            fontSize: 12,
                            marginTop: 2,
                            color: "#555",
                          }}
                        >
                          Vacation: {s.vacationFrom} → {s.vacationTo}
                        </div>
                      )}

                      <div
                        style={{
                          marginTop: 8,
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <button onClick={() => toggleSubscriptionActive(s)}>
                          Pause
                        </button>

                        <button onClick={() => handleSkipTomorrow(s)}>
                          Skip tomorrow
                        </button>
                      </div>

                      {/* Vacation Range */}
                      <div style={{ marginTop: 8, fontSize: 13 }}>
                        <div>Skip date range (vacation):</div>

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            marginTop: 4,
                            flexWrap: "wrap",
                          }}
                        >
                          <input
                            type="date"
                            value={vacationFromMap[s.id] || ""}
                            onChange={(e) =>
                              setVacationFromMap((prev) => ({
                                ...prev,
                                [s.id]: e.target.value,
                              }))
                            }
                          />

                          <input
                            type="date"
                            value={vacationToMap[s.id] || ""}
                            onChange={(e) =>
                              setVacationToMap((prev) => ({
                                ...prev,
                                [s.id]: e.target.value,
                              }))
                            }
                          />

                          <button
                            onClick={() =>
                              handleSetVacationRange(
                                s,
                                vacationFromMap[s.id] || "",
                                vacationToMap[s.id] || ""
                              )
                            }
                          >
                            Save range
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* PAUSED SUBSCRIPTIONS */}
          {pausedSubs.length > 0 && (
            <>
              <h3>Paused</h3>

              <ul style={{ listStyle: "none", padding: 0 }}>
                {pausedSubs.map((s) => (
                  <li
                    key={s.id}
                    style={{
                      padding: 12,
                      border: "1px solid #e0e0e0",
                      borderRadius: 10,
                      marginBottom: 8,
                      opacity: 0.7,
                    }}
                  >
                    <div>
                      <strong>
                        {s.productName} ({s.unit})
                      </strong>
                    </div>

                    <div style={{ fontSize: 14 }}>
                      Base qty: {s.qty} · Schedule: {formatSchedule(s)}
                    </div>

                    <div style={{ fontSize: 13, marginTop: 2 }}>
                      Deliver to: {formatAddress(s.deliveryAddress)}
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <button onClick={() => toggleSubscriptionActive(s)}>
                        Resume
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
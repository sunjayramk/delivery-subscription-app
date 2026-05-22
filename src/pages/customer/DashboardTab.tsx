import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";

interface DashboardTabProps {
  walletBalance: number;
  activeSubscriptions: number;
  totalOrders: number;
  subscriptions: any[];
  setActiveTab: (tab: string) => void;
  handleToggleSkipDate: (sub: any, dateStr: string) => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Helper to check if a sub runs on a specific date
function shouldRunOnDate(sub: any, targetDate: Date): boolean {
  if (!sub.isActive) return false;
  
  const dateStr = targetDate.toLocaleDateString('en-CA'); // YYYY-MM-DD local timezone

  if (sub.vacationFrom && sub.vacationTo) {
    if (dateStr >= sub.vacationFrom && dateStr <= sub.vacationTo) return false;
  }

  const weekday = targetDate.getDay(); 
  switch (sub.scheduleType) {
    case "daily": return true;
    case "mon_fri": return weekday >= 1 && weekday <= 5;
    case "weekends": return weekday === 0 || weekday === 6;
    case "custom": return sub.scheduleDays?.includes(weekday) || false;
    case "alternate_days": {
      if (!sub.startDate) return true;
      const start = sub.startDate.toDate ? sub.startDate.toDate() : new Date(sub.startDate);
      const targetMid = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const startMid = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const diff = Math.floor((targetMid.getTime() - startMid.getTime()) / 86400000);
      return diff % 2 === 0;
    }
    default: return true;
  }
}

export default function DashboardTab({ subscriptions, setActiveTab, handleToggleSkipDate }: DashboardTabProps) {
  const { user } = useAuth();
  
  // State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [localSubs, setLocalSubs] = useState(subscriptions);

  useEffect(() => { setLocalSubs(subscriptions); }, [subscriptions]);

  // Calendar Logic (Mon-Sun format)
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Convert Sun(0) to 6, Mon(1) to 0
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const startingBlankDays = getFirstDayOfMonth(year, month);
  
  const prevMonthDays = getDaysInMonth(year, month - 1);
  
  const handlePrevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));
  
  const handleDateClick = (day: number) => setSelectedDate(new Date(year, month, day));

  // Quantity Change Handler
  const handleQtyChange = async (sub: any, delta: number) => {
    if (!user?.tenantId) return;
    const weekday = selectedDate.getDay();
    const currentQty = sub.dayQuantities?.[weekday] ?? sub.qty ?? 1;
    const newQty = Math.max(1, currentQty + delta); // Min 1. To go to 0, use Cancel/Skip.

    // Optimistic UI
    setLocalSubs((prev) => prev.map((s) => s.id === sub.id ? { ...s, dayQuantities: { ...(s.dayQuantities || {}), [weekday]: newQty } } : s));

    // Save to Firebase
    try {
      await updateDoc(doc(db, "tenants", user.tenantId, "subscriptions", sub.id), {
        dayQuantities: { ...(sub.dayQuantities || {}), [weekday]: newQty },
        updatedAt: serverTimestamp(),
      });
    } catch (err) { console.error("Failed to update qty", err); }
  };

  // Prepare Selected Date Data
  const selectedDateStr = selectedDate.toLocaleDateString('en-CA');
  const activeItemsForSelectedDate = localSubs.filter((s) => shouldRunOnDate(s, selectedDate));
  
  const formattedSelectedDate = () => {
    const today = new Date().toLocaleDateString('en-CA');
    const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA');
    if (selectedDateStr === today) return `Today, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()].slice(0, 3)}`;
    if (selectedDateStr === tomorrow) return `Tomorrow, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()].slice(0, 3)}`;
    return `${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f9fafb" }}>
      
      {/* Date TOP HALF: THE CALENDAR */}
      <div style={{ background: "#fff", padding: "20px 16px", borderBottom: "1px solid #e5e7eb", borderRadius: "0 0 24px 24px", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
        
        {/* Month Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <button onClick={handlePrevMonth} style={navButtonStyle}>Prev</button>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>
            {MONTHS[month]} {year}
          </h2>
          <button onClick={handleNextMonth} style={navButtonStyle}>Next</button>
        </div>

        {/* Weekdays Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 12 }}>
          {WEEKDAYS.map(day => (
            <div key={day} style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: "#9ca3af" }}>
              {day}
            </div>
          ))}
        </div>

        {/* Dates Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px 4px" }}>
          
          {/* Blank slots for previous month */}
          {Array.from({ length: startingBlankDays }).map((_, i) => (
            <div key={`blank-${i}`} style={{ textAlign: "center", padding: "10px 0", color: "#d1d5db", fontSize: 14 }}>
              {prevMonthDays - startingBlankDays + i + 1}
            </div>
          ))}

          {/* Actual days of the current month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const thisDate = new Date(year, month, dayNum);
            const thisDateStr = thisDate.toLocaleDateString('en-CA');
            const isSelected = selectedDateStr === thisDateStr;
            const isToday = new Date().toLocaleDateString('en-CA') === thisDateStr;
            
            // Does this day have any active deliveries?
            const itemsToday = localSubs.filter((s) => shouldRunOnDate(s, thisDate));
            const hasDeliveries = itemsToday.length > 0;
            // Are all deliveries skipped today?
            const allSkipped = hasDeliveries && itemsToday.every(s => s.skipDates?.includes(thisDateStr));

            return (
              <div 
                key={dayNum} 
                onClick={() => handleDateClick(dayNum)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: "8px 0", borderRadius: 12, cursor: "pointer", position: "relative",
                  background: isSelected ? "#2563eb" : "transparent",
                  color: isSelected ? "#fff" : isToday ? "#2563eb" : "#374151",
                  fontWeight: isSelected || isToday ? 700 : 500,
                  transition: "all 0.2s"
                }}
              >
                <span style={{ fontSize: 15 }}>{dayNum}</span>
                
                {/* Delivery Indicator Dot */}
                {hasDeliveries && (
                  <div style={{ 
                    width: 4, height: 4, borderRadius: "50%", marginTop: 4,
                    background: isSelected ? "#fff" : allSkipped ? "#ef4444" : "#2563eb",
                    opacity: allSkipped ? 0.5 : 1
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Package BOTTOM HALF: SELECTED DATE DETAILS */}
      <div style={{ padding: 20, flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: "#111827", fontWeight: 700 }}>Arriving {formattedSelectedDate()}</h3>
            <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#6b7280" }}>{activeItemsForSelectedDate.length} items scheduled</p>
          </div>
          <button onClick={() => setActiveTab("products")} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, cursor: "pointer", boxShadow: "0 2px 8px rgba(37,99,235,0.2)" }}>
            <span>+</span> Add Items
          </button>
        </div>

        {activeItemsForSelectedDate.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", background: "#fff", borderRadius: 16, border: "1px dashed #d1d5db" }}>
            <p style={{ margin: 0, color: "#6b7280", fontWeight: 500, fontSize: 14 }}>No deliveries on this day.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {activeItemsForSelectedDate.map((sub) => {
              const isSkipped = sub.skipDates?.includes(selectedDateStr);
              const weekday = selectedDate.getDay();
              const qtyForDay = sub.dayQuantities?.[weekday] ?? sub.qty ?? 1;

              return (
                <div key={sub.id} style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", border: "1px solid #f3f4f6", opacity: isSkipped ? 0.6 : 1, transition: "opacity 0.2s" }}>
                  
                  {/* Item Details Row */}
                  <div style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ width: 48, height: 48, background: "#eff6ff", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                        Milk {/* Placeholder for product image */}
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: 15, color: "#111827", textDecoration: isSkipped ? "line-through" : "none" }}>{sub.productName}</h4>
                        <p style={{ margin: "2px 0 0 0", fontSize: 13, color: "#6b7280" }}>{sub.unit} | <span style={{ fontWeight: 600, color: "#111827" }}>Rs.{sub.price}</span></p>
                      </div>
                    </div>

                    {/* Inline Qty Adjuster (Image 3 Style) */}
                    <div style={{ display: "flex", alignItems: "center", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", pointerEvents: isSkipped ? "none" : "auto", opacity: isSkipped ? 0.5 : 1 }}>
                      <button onClick={() => handleQtyChange(sub, -1)} style={{ padding: "8px 12px", background: "#f9fafb", border: "none", borderRight: "1px solid #e5e7eb", color: "#374151", fontWeight: 600, fontSize: 16, cursor: "pointer" }}>-</button>
                      <div style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", fontWeight: 700, fontSize: 14 }}>{qtyForDay}</div>
                      <button onClick={() => handleQtyChange(sub, 1)} style={{ padding: "8px 12px", background: "#f9fafb", border: "none", borderLeft: "1px solid #e5e7eb", color: "#374151", fontWeight: 600, fontSize: 16, cursor: "pointer" }}>+</button>
                    </div>
                  </div>

                  {/* Cancel / Resume Action Bar */}
                  <div 
                    onClick={() => handleToggleSkipDate(sub, selectedDateStr)}
                    style={{ 
                      background: isSkipped ? "#f0fdf4" : "#fef2f2", 
                      padding: "12px", 
                      textAlign: "center", 
                      cursor: "pointer", 
                      borderTop: isSkipped ? "1px solid #bbf7d0" : "1px solid #fecaca",
                      transition: "all 0.2s"
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: isSkipped ? "#16a34a" : "#dc2626" }}>
                      {isSkipped ? "OK Delivery Skipped (Tap to Resume)" : "Cancel Delivery for this day"}
                    </span>
                  </div>
                  
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Styling for the month navigation buttons
const navButtonStyle = {
  background: "#f3f4f6", border: "none", borderRadius: "50%", 
  width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 14, color: "#4b5563", cursor: "pointer"
};

import { useEffect, useState } from "react";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";

interface Notification {
  id: string;
  title: string;
  message: string;
  createdAt?: Date;
  read: boolean;
  type: string;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user || !user.tenantId) return;

    const q = query(
      collection(db, "tenants", user.tenantId, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(15)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: Notification[] = [];
      let unread = 0;
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const createdAt = data.createdAt?.toDate
          ? data.createdAt.toDate()
          : undefined;
        if (!data.read) unread += 1;
        list.push({
          id: docSnap.id,
          title: data.title || "",
          message: data.message || "",
          createdAt,
          read: !!data.read,
          type: data.type || "",
        });
      });
      setNotifications(list);
      setUnreadCount(unread);
    });

    return () => unsub();
  }, [user]);

  async function markAllRead() {
    if (!user || !user.tenantId) return;
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(
      unread.map((n) => updateDoc(
        doc(db, "tenants", user.tenantId!, "notifications", n.id),
        { read: true }
      ))
    );
  }

  function toggleOpen() {
    const newOpen = !open;
    setOpen(newOpen);
    if (newOpen) {
      void markAllRead();
    }
  }

  if (!user) return null;

  return (
    <div style={{ position: "relative", marginLeft: 12 }}>
      <button
        onClick={toggleOpen}
        title="Notifications"
        style={{
          position: "relative",
          borderRadius: "50%",
          width: 36,
          height: 36,
          border: "1px solid #ddd",
          background: "#fff",
          cursor: "pointer",
          fontSize: 16,
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        !
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "red",
              color: "white",
              borderRadius: "50%",
              padding: "0 5px",
              fontSize: 10,
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            marginTop: 4,
            width: 320,
            maxHeight: 360,
            overflowY: "auto",
            background: "#fff",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            borderRadius: 8,
            zIndex: 20,
          }}
        >
          <div
            style={{
              padding: 8,
              borderBottom: "1px solid #eee",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Notifications
          </div>
          {notifications.length === 0 ? (
            <div style={{ padding: 10, fontSize: 13 }}>No notifications yet.</div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: 10,
                  borderBottom: "1px solid #f0f0f0",
                  background: n.read ? "#fff" : "#f9f9ff",
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 600 }}>{n.title}</div>
                <div style={{ marginTop: 2 }}>{n.message}</div>
                {n.createdAt && (
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 11,
                      color: "#777",
                    }}
                  >
                    {n.createdAt.toLocaleString()}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

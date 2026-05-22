import { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect by role
  useEffect(() => {
    if (!user) return;

    // Check if the user has ANY of the admin panel roles
    const adminRoles = ["admin", "tenant_admin", "delivery_manager", "account_manager", "data_manager", "view_only"];

    if (adminRoles.includes(user.role)) {
      navigate("/admin", { replace: true });
    } else if (user.role === "platform_super_admin") {
      navigate("/platform", { replace: true });
    } else if (user.role === "agent") {
      navigate("/agent", { replace: true });
    } else if (user.role === "customer") {
      navigate("/app", { replace: true });
    } else {
      // Fallback just in case a role is missing
      console.warn("Unknown role:", user.role);
      navigate("/app", { replace: true }); 
    }
  }, [user, navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // after login, AuthContext updates and useEffect above redirects
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Login failed");
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 400, margin: "40px auto" }}>
      <h1>Login</h1>
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: 12 }}>
          <label>Email</label>
          <input
            style={{ width: "100%", padding: 8 }}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Password</label>
          <input
            style={{ width: "100%", padding: 8 }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" style={{ padding: "8px 16px" }}>
          Login
        </button>
      </form>
    </div>
  );
}

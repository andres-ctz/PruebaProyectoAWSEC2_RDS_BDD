import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { errMsg } from "../api.js";
import { useAuth } from "../AuthContext.jsx";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "register") await api.post("/users", form);
      const { data } = await api.post("/login", { email: form.email, password: form.password });
      login(data.access_token, data.user);
      nav("/");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="tabs">
        <button className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>Iniciar sesión</button>
        <button className={mode === "register" ? "on" : ""} onClick={() => setMode("register")}>Crear cuenta</button>
      </div>
      <form onSubmit={submit} className="stack">
        {mode === "register" && (
          <label>Nombre<input required minLength={2} value={form.name} onChange={set("name")} /></label>
        )}
        <label>Correo<input type="email" required value={form.email} onChange={set("email")} /></label>
        <label>Contraseña<input type="password" required minLength={6} value={form.password} onChange={set("password")} /></label>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy}>
          {busy ? "Un momento..." : mode === "login" ? "Entrar" : "Crear cuenta"}
        </button>
      </form>
    </div>
  );
}

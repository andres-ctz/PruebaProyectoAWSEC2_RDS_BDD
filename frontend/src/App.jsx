import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import Auth from "./pages/Auth.jsx";
import Home from "./pages/Home.jsx";
import Watch from "./pages/Watch.jsx";
import Profile from "./pages/Profile.jsx";

function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <header className="nav">
      <Link to="/" className="brand">Videoteca</Link>
      <nav>
        {user ? (
          <>
            <Link to="/perfil">{user.name}</Link>
            <button className="btn ghost" onClick={() => { logout(); nav("/"); }}>Cerrar sesión</button>
          </>
        ) : (
          <Link to="/auth" className="btn">Iniciar sesión</Link>
        )}
      </nav>
    </header>
  );
}

function Protected({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/auth" replace />;
}

export default function App() {
  return (
    <>
      <Navbar />
      <main className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/video/:id" element={<Watch />} />
          <Route path="/perfil" element={<Protected><Profile /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

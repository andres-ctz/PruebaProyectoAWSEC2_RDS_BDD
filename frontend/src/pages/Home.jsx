import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errMsg, fmtDate, fmtViews } from "../api.js";

export function VideoCard({ v, compact }) {
  return (
    <Link to={`/video/${v.id}`} className={compact ? "card compact" : "card"}>
      <img src={v.thumbnail_url} alt={v.title} loading="lazy" />
      <div className="meta">
        <h3>{v.title}</h3>
        <p>{v.author_name}</p>
        <p>{fmtViews(v.views)}, {fmtDate(v.created_at)}</p>
      </div>
    </Link>
  );
}

export default function Home() {
  const [videos, setVideos] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/videos").then((r) => setVideos(r.data)).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!videos) return <p className="muted">Cargando videos...</p>;
  if (!videos.length) return <p className="muted">Aún no hay videos. Inicia sesión y publica el primero desde tu perfil.</p>;
  return <div className="grid">{videos.map((v) => <VideoCard key={v.id} v={v} />)}</div>;
}

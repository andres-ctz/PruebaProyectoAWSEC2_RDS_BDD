import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { errMsg, fmtDate, fmtViews } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { VideoCard } from "./Home.jsx";

export default function Watch() {
  const { id } = useParams();
  const { user } = useAuth();
  const [video, setVideo] = useState(null);
  const [comments, setComments] = useState([]);
  const [related, setRelated] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setVideo(null);
    setError("");
    window.scrollTo(0, 0);
    Promise.all([
      api.get(`/videos/${id}`),
      api.get(`/videos/${id}/comments`),
      api.get(`/videos`, { params: { exclude: id, random: true, limit: 8 } }),
    ])
      .then(([v, c, r]) => { setVideo(v.data); setComments(c.data); setRelated(r.data); })
      .catch((e) => setError(errMsg(e)));
  }, [id]);

  async function addComment(e) {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const { data } = await api.post(`/videos/${id}/comments`, { content: text });
      setComments([data, ...comments]);
      setText("");
    } catch (err) {
      setError(errMsg(err));
    }
  }

  if (error && !video) return <p className="error">{error}</p>;
  if (!video) return <p className="muted">Cargando...</p>;

  return (
    <div className="watch">
      <section>
        <video key={video.video_url} src={video.video_url} controls autoPlay className="player" />
        <h1>{video.title}</h1>
        <p className="muted">{video.author_name}, {fmtViews(video.views)}, {fmtDate(video.created_at)}</p>
        {video.description && <p className="desc">{video.description}</p>}

        <h2>{comments.length} {comments.length === 1 ? "comentario" : "comentarios"}</h2>
        {user ? (
          <form onSubmit={addComment} className="comment-form">
            <input placeholder="Escribe un comentario" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
            <button className="btn">Comentar</button>
          </form>
        ) : (
          <p className="muted"><Link to="/auth">Inicia sesión</Link> para comentar.</p>
        )}
        {error && <p className="error">{error}</p>}
        <ul className="comments">
          {comments.map((c) => (
            <li key={c.id}>
              <strong>{c.author_name}</strong> <span className="muted">{fmtDate(c.created_at)}</span>
              <p>{c.content}</p>
            </li>
          ))}
        </ul>
      </section>
      <aside>
        <h2>Recomendados</h2>
        {related.length === 0 && <p className="muted">No hay más videos por ahora.</p>}
        {related.map((v) => <VideoCard key={v.id} v={v} compact />)}
      </aside>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errMsg, fmtDate, fmtViews } from "../api.js";
import { useAuth } from "../AuthContext.jsx";

const MAX_VIDEO = 100 * 1024 * 1024;

export default function Profile() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [videos, setVideos] = useState([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ title: "", description: "", video: null, thumbnail: null });
  const [progress, setProgress] = useState(null);
  const [editing, setEditing] = useState(null); // {id, title, description}

  async function load() {
    try {
      const [u, v] = await Promise.all([
        api.get(`/users/${user.id}`),
        api.get("/videos", { params: { user_id: user.id, limit: 100 } }),
      ]);
      setCount(u.data.video_count);
      setVideos(v.data);
    } catch (e) {
      setError(errMsg(e));
    }
  }
  useEffect(() => { load(); }, []);

  async function publish(e) {
    e.preventDefault();
    setError(""); setMsg("");
    const { video, thumbnail } = form;
    if (!video || !thumbnail) return setError("Selecciona el video y la miniatura");
    if (video.type !== "video/mp4") return setError("El video debe ser MP4");
    if (video.size > MAX_VIDEO) return setError("El video supera 100 MB");
    if (!["image/jpeg", "image/png"].includes(thumbnail.type)) return setError("La miniatura debe ser JPG o PNG");

    const data = new FormData();
    data.append("title", form.title);
    data.append("description", form.description);
    data.append("video", video);
    data.append("thumbnail", thumbnail);
    try {
      setProgress(0);
      await api.post("/videos", data, {
        onUploadProgress: (p) => setProgress(Math.round((p.loaded * 100) / (p.total || video.size))),
      });
      setForm({ title: "", description: "", video: null, thumbnail: null });
      e.target.reset();
      setMsg("Video publicado");
      load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setProgress(null);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    try {
      await api.put(`/videos/${editing.id}`, { title: editing.title, description: editing.description });
      setEditing(null);
      setMsg("Video actualizado");
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function remove(v) {
    if (!window.confirm(`¿Eliminar "${v.title}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/videos/${v.id}`);
      setMsg("Video eliminado");
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <div className="profile">
      <section className="head">
        <h1>{user.name}</h1>
        <p className="muted">{user.email}, {count} {count === 1 ? "video publicado" : "videos publicados"}</p>
      </section>

      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}

      <section>
        <h2>Publicar un video</h2>
        <form onSubmit={publish} className="stack upload">
          <label>Título<input required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label>Descripción<textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label>Video (MP4, máx. 100 MB)<input type="file" accept="video/mp4" required onChange={(e) => setForm({ ...form, video: e.target.files[0] })} /></label>
          <label>Miniatura (JPG o PNG)<input type="file" accept="image/jpeg,image/png" required onChange={(e) => setForm({ ...form, thumbnail: e.target.files[0] })} /></label>
          {progress !== null && <div className="bar"><div style={{ width: `${progress}%` }} /></div>}
          <button className="btn" disabled={progress !== null}>{progress !== null ? `Subiendo ${progress}%` : "Publicar"}</button>
        </form>
      </section>

      <section>
        <h2>Mis videos</h2>
        {videos.length === 0 && <p className="muted">Todavía no has publicado nada.</p>}
        {videos.map((v) => (
          <div key={v.id} className="row">
            <img src={v.thumbnail_url} alt="" />
            {editing?.id === v.id ? (
              <form onSubmit={saveEdit} className="stack grow">
                <input required value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                <textarea rows={2} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                <div className="actions">
                  <button className="btn">Guardar cambios</button>
                  <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancelar</button>
                </div>
              </form>
            ) : (
              <>
                <div className="grow">
                  <Link to={`/video/${v.id}`}><h3>{v.title}</h3></Link>
                  <p className="muted">{fmtViews(v.views)}, {fmtDate(v.created_at)}</p>
                </div>
                <div className="actions">
                  <button className="btn ghost" onClick={() => setEditing({ id: v.id, title: v.title, description: v.description })}>Editar</button>
                  <button className="btn danger" onClick={() => remove(v)}>Eliminar</button>
                </div>
              </>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

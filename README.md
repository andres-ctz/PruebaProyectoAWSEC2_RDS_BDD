# Videoteca: plataforma de videos con React, FastAPI y AWS

Single Page Application para publicar y ver videos. Los usuarios se registran, inician sesión, suben videos con su miniatura, los reproducen, comentan y gestionan sus publicaciones.

## Enlaces (mientras el despliegue esté activo)

| Recurso | URL |
|---|---|
| SPA (S3) | `http://andres-vp-fronted.s3-website.us-east-2.amazonaws.com` (verifica que coincida con tu endpoint de Static website hosting) |
| API / documentación | `http://3.135.66.6/docs` |
| Repositorio | https://github.com/andres-ctz/PruebaProyectoAWSEC2_RDS_BDD |

## Arquitectura

```
                  Navegador
                      │
        ┌─────────────┴──────────────┐
        │                            │
        ▼                            ▼
 S3 Frontend                 EC2 (Ubuntu 24.04)
 andres-vp-fronted           Nginx :80 → FastAPI :8000
 (dist/ de React)                │            │
                                 │            │ boto3 (IAM Role)
                                 ▼            ▼
                         RDS PostgreSQL    S3 Videos  andres-vp-videos
                         videoplatform-db  S3 Miniaturas andres-vp-thumbs
```

- **Frontend:** React + Vite, compilado a `dist/` y servido desde S3 como sitio estático. Usa `HashRouter` para funcionar sin reglas de redirección.
- **API:** FastAPI detrás de Nginx, ejecutada como servicio `systemd`.
- **Base de datos:** Amazon RDS (PostgreSQL), solo datos estructurados.
- **Archivos:** los videos (MP4) y las miniaturas (JPG/PNG) se guardan en S3. La API los sube y la base de datos guarda únicamente la URL.
- **Región:** `us-east-2` (Ohio) para todos los servicios.

## Seguridad y conexión entre servicios

- **Security Groups:** `sg-ec2` permite HTTP (80) desde internet y SSH (22) solo desde la IP del administrador. `sg-rds` permite PostgreSQL (5432) únicamente con origen `sg-ec2`. RDS no tiene acceso público.
- **IAM Role:** la EC2 usa el rol `vp-ec2-role`, con permisos `PutObject`, `GetObject` y `DeleteObject` solo sobre los buckets de videos y miniaturas. No hay llaves de AWS en el código.
- **Variables de entorno:** la configuración sensible vive en un archivo `.env` en el servidor, fuera del repositorio.
- **Autenticación:** JWT en el encabezado `Authorization: Bearer`. Las contraseñas se almacenan con hash bcrypt.
- **Permisos:** solo el dueño de un video puede editarlo o eliminarlo (403 en caso contrario).

## Estructura del repositorio

```
.
├── backend/
│   ├── app/
│   │   ├── main.py        # App, CORS y routers
│   │   ├── config.py      # Variables de entorno
│   │   ├── database.py    # Conexión SQLAlchemy
│   │   ├── models.py      # User, Video, Comment
│   │   ├── schemas.py     # Esquemas Pydantic
│   │   ├── auth.py        # bcrypt y JWT
│   │   ├── s3.py          # Subida y borrado en S3
│   │   └── routers/       # users.py, videos.py, comments.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── pages/         # Auth, Home, Watch, Profile
    │   ├── api.js         # Cliente axios con token
    │   ├── AuthContext.jsx
    │   └── App.jsx
    ├── package.json
    └── .env.example
```

## Endpoints de la API

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| POST | `/users` | Crear usuario | No |
| POST | `/login` | Iniciar sesión, devuelve token | No |
| GET | `/users/{id}` | Datos básicos y cantidad de videos | No |
| POST | `/videos` | Publicar video y miniatura (multipart) | Sí |
| GET | `/videos` | Listar (`user_id`, `exclude`, `random`, `limit`, `offset`) | No |
| GET | `/videos/{id}` | Detalle, suma una vista | No |
| PUT | `/videos/{id}` | Actualizar título o descripción | Dueño |
| DELETE | `/videos/{id}` | Eliminar video y archivos de S3 | Dueño |
| POST | `/videos/{id}/comments` | Comentar | Sí |
| GET | `/videos/{id}/comments` | Listar comentarios | No |

Documentación interactiva en `/docs`.

## Modelo de datos

- **users:** `id`, `name`, `email` (único), `password_hash`
- **videos:** `id`, `title`, `description`, `video_url`, `thumbnail_url`, `views`, `created_at`, `user_id`
- **comments:** `id`, `content`, `user_id`, `video_id`, `created_at`

Las tablas se crean automáticamente al iniciar la API.

## Variables de entorno (backend)

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | `postgresql+psycopg2://usuario:clave@ENDPOINT_RDS:5432/videoplatform` |
| `JWT_SECRET` | Cadena larga y aleatoria para firmar tokens |
| `AWS_REGION` | `us-east-2` |
| `VIDEOS_BUCKET` | Bucket de videos |
| `THUMBS_BUCKET` | Bucket de miniaturas |
| `CORS_ORIGINS` | URL del sitio S3, separadas por coma si hay varias |
| `STORAGE` | Opcional. `local` guarda en `backend/uploads/` (solo desarrollo). Por defecto `s3` |
| `PUBLIC_BASE_URL` | Solo con `STORAGE=local` (por ejemplo `http://localhost:8000`) |

Frontend: `VITE_API_URL` con la URL base de la API. Se incrusta al compilar.

## Ejecución en local

**Backend**

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # para pruebas: DATABASE_URL=sqlite:///./local.db y STORAGE=local
uvicorn app.main:app --reload
```

**Frontend**

```bash
cd frontend
cp .env.example .env     # VITE_API_URL=http://localhost:8000
npm install
npm run dev
```

## Despliegue

1. **Red:** crear `sg-ec2` y `sg-rds`.
2. **RDS:** PostgreSQL, sin acceso público, con la base inicial `videoplatform`.
3. **S3:** tres buckets. Los de videos y miniaturas con política de lectura pública y CORS (`GET`, `HEAD`). El de frontend con *Static website hosting* (`index.html`).
4. **IAM:** rol `vp-ec2-role` con permisos mínimos sobre los dos buckets de archivos.
5. **EC2:** Ubuntu 24.04, con el rol asignado y una Elastic IP.
6. **Servidor:**
   ```bash
   sudo apt update && sudo apt install -y python3-venv python3-pip nginx git
   git clone https://github.com/andres-ctz/PruebaProyectoAWSEC2_RDS_BDD.git
   cd PruebaProyectoAWSEC2_RDS_BDD/backend
   python3 -m venv venv && source venv/bin/activate
   pip install -r requirements.txt
   ```
   Crear el `.env` con las variables anteriores. Configurar `fastapi.service` (systemd) y Nginx como proxy a `127.0.0.1:8000` con `client_max_body_size 100M`.
7. **Frontend:**
   ```bash
   cd frontend
   echo "VITE_API_URL=http://3.135.66.6" > .env.production
   npm install && npm run build
   aws s3 sync dist/ s3://andres-vp-fronted --delete --region us-east-2
   ```
8. **CORS:** poner la URL del sitio S3 en `CORS_ORIGINS` y ejecutar `sudo systemctl restart fastapi`.

## Restricciones de la plataforma

- Video: solo MP4, máximo 100 MB.
- Miniatura: JPG, JPEG o PNG, máximo 5 MB.

## Autor

Andrés Calva

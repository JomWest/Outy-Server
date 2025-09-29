# OUTY REST API

API RESTful optimizada que usa SQL Server como base de datos y sigue las mejores prácticas de seguridad, validación y documentación.

## Requisitos

- Node.js 18+
- SQL Server local (por ejemplo `SQLEXPRESS`) con las tablas del diagrama ER.

## Configuración

1. Copia `.env.example` a `.env` y ajusta valores.

Para Windows Authentication (lo que muestra tu captura):

```
PORT=4000
SQLSERVER_AUTH=windows
SQLSERVER_SERVER=AZAZYEL
SQLSERVER_DATABASE=OUTY_DB
SQLSERVER_ENCRYPT=false
SQLSERVER_TRUST_SERVER_CERTIFICATE=true
JWT_SECRET=replace_with_strong_secret
CACHE_TTL_SECONDS=60

Para autenticación SQL (usuario/contraseña):

```
SQLSERVER_AUTH=sql
SQLSERVER_SERVER=AZAZYEL\SQLEXPRESS
SQLSERVER_DATABASE=OUTY_DB
SQLSERVER_USER=sa
SQLSERVER_PASSWORD=YourStrong(!)Password
SQLSERVER_ENCRYPT=true
SQLSERVER_TRUST_SERVER_CERTIFICATE=true
```
```

2. Instala dependencias y arranca:

```
npm install
npm run dev
```

## Endpoints principales

- `POST /api/auth/login` — devuelve JWT (requiere email y password)
- CRUD genérico para recursos del ER: `users`, `skills`, `job_categories`, `jobs`, `locations_nicaragua`, `company_profiles`, `candidate_profiles`, `education`, `work_experience`, `candidate_skills`, `job_applications`, `conversations`, `conversation_participants`, `messages`, `reviews`.

Ejemplos:

- `GET /api/jobs?page=1&pageSize=20&sortBy=created_at&sortOrder=DESC`
- `GET /api/jobs/123`
- `POST /api/jobs` (requiere JWT) — body validado con Zod
- `PUT /api/jobs/123` (requiere JWT)
- `DELETE /api/jobs/123` (requiere JWT)

## Documentación Swagger

Disponible en `http://localhost:4000/docs` una vez corriendo.

## Performance y seguridad

- Pool de conexiones y consultas parametrizadas (prevención de SQL injection)
- Paginación con `OFFSET ... FETCH` y conteo total
- Caché LRU en memoria para GET (TTL configurable)
- CORS, Helmet y rate limit para endurecer la API
- Validación de entrada con Zod (sanitización por lista blanca de columnas)


## Problemas comunes

- Error de conexión: valida `SQLSERVER_SERVER` (p.ej. `localhost\\SQLEXPRESS`) y permisos del usuario.
- Tablas/columnas distintas: ajusta `src/web/validation/schemas.js` y los `idColumn` en `src/web/routes/index.js`.
- JWT inválido: revisa `JWT_SECRET` y el encabezado `Authorization: Bearer <token>`.

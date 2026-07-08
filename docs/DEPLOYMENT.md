# Guía de Despliegue

## Requisitos

- Docker 24+ y Docker Compose v2
- Node.js 20+ (solo para desarrollo local)
- PostgreSQL 16 (gestionado por Docker en producción)
- Redis 7 (gestionado por Docker en producción)

---

## Desarrollo local (sin Docker)

### 1. Clonar e instalar

```bash
git clone https://github.com/DaltonP93/comedor
cd comedor
npm install
```

### 2. Variables de entorno

```bash
cp .env.example apps/api/.env
# Editar apps/api/.env con valores locales
```

Variables mínimas:
```
DATABASE_URL=postgresql://comedor:comedor123@localhost:5432/comedor
REDIS_URL=redis://localhost:6379
JWT_SECRET=cambiar-esto-en-produccion
JWT_REFRESH_SECRET=cambiar-esto-en-produccion-refresh
```

### 3. Iniciar PostgreSQL y Redis (Docker)

```bash
docker compose up postgres redis -d
```

### 4. Migraciones y seed

```bash
npm run db:generate
npm run db:deploy
npm run db:seed
```

### 5. Iniciar servidor de desarrollo

```bash
npm run dev          # API (3001) + Admin (5173)
npm run dev:cliente  # Portal cliente (5174)
```

---

## Docker (producción)

### Primera vez

```bash
# Copiar y completar variables
cp .env.example .env
# Editar .env con valores de producción

# Levantar todo
docker compose -f docker-compose.prod.yml up -d --build

# Migraciones (primera vez)
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# Seed inicial
docker compose -f docker-compose.prod.yml exec api npx ts-node ../../packages/database/prisma/seed.ts
```

### Accesos por defecto

| Servicio    | URL                          |
|-------------|------------------------------|
| Admin       | http://localhost/admin       |
| Cliente     | http://localhost/cliente     |
| API         | http://localhost/api         |
| Health      | http://localhost/api/health  |

**Usuario inicial:** `admin@comedor.com` / `admin123` (cambiar en producción)

### Actualización

```bash
git pull origin main
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

### Rollback

```bash
# Volver a imagen anterior
docker compose -f docker-compose.prod.yml down
git checkout <tag-anterior>
docker compose -f docker-compose.prod.yml up -d
```

---

## Variables de entorno completas

Ver `.env.example` para la lista completa. Variables críticas:

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Conexión PostgreSQL |
| `REDIS_URL` | Conexión Redis |
| `JWT_SECRET` | Secreto tokens de acceso (mínimo 32 chars) |
| `JWT_REFRESH_SECRET` | Secreto refresh tokens |
| `SIFEN_HABILITADO` | `true` para facturación real |
| `BANCARD_PRIVATE_KEY` | Credenciales Bancard real |
| `PAGOPAR_TOKEN_PRIVADO` | Credenciales Pagopar real |

---

## Backups

```bash
# Backup manual
./scripts/backup-postgres.sh

# Configurar backup diario (crontab)
0 2 * * * /ruta/comedor/scripts/backup-postgres.sh >> /var/log/comedor-backup.log 2>&1

# Restaurar
./scripts/restore-postgres.sh /backups/comedor_20260514_020000.sql.gz
```

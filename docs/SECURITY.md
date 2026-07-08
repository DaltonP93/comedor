# Guía de Seguridad

## Autenticación

### Tokens JWT

- **Access token**: expira en 8 horas, firmado con `JWT_SECRET`
- **Refresh token**: expira en 7 días, hash SHA-256 almacenado en `UserSession`
- Rotación automática: cada refresh genera nuevo token y revoca el anterior
- Logout revoca todas las sesiones del usuario

### Sesiones persistentes

La tabla `user_sessions` guarda:
- Hash del refresh token (nunca el token en claro)
- IP y User-Agent
- Fecha de expiración y revocación

---

## Rate Limiting

Implementado con Redis (fallback en memoria):

| Endpoint | Límite |
|----------|--------|
| POST /auth/login | 5 intentos / 15 min |
| POST /auth/refresh | 10 intentos / 5 min |
| Webhooks | 100 / min |

---

## Sistema de permisos

Formato: `MODULO:ACCION` (ej: `VENTAS:CREAR`, `CAJA:CERRAR`)

El rol `SUPERADMIN` tiene todos los permisos (`*`).

Verificación en cada endpoint:
```typescript
router.post('/', requirePermiso('VENTAS:CREAR'), async (req, res) => { ... });
```

---

## Auditoría

Se audita automáticamente:
- Login / Logout / Intentos fallidos
- Creación y anulación de ventas
- Apertura y cierre de caja
- Movimientos de stock y libreta
- Emisión y anulación de facturas
- Webhooks recibidos y procesados
- Cambios de configuración y permisos

---

## Seguridad de webhooks

Cada webhook:
1. Verifica firma criptográfica del proveedor (SHA-256)
2. Persiste en `webhook_eventos` para idempotencia
3. No procesa el mismo `event_id` dos veces
4. Siempre responde HTTP 200 (el proveedor no reintenta en error)

---

## Checklist producción

- [ ] Cambiar `JWT_SECRET` y `JWT_REFRESH_SECRET` a valores aleatorios de 64+ chars
- [ ] Configurar `CORS_ORIGIN` con dominios reales (no `*`)
- [ ] No exponer puertos de PostgreSQL ni Redis al exterior
- [ ] Usar HTTPS (certificado SSL en Nginx)
- [ ] Configurar `NODE_ENV=production`
- [ ] Configurar `BCRYPT_ROUNDS=12` (mínimo en producción)
- [ ] Rotar credenciales de Bancard/Pagopar entre sandbox y producción
- [ ] Revisar logs periódicamente para detectar intentos de acceso

---

## Secretos que NUNCA deben estar en el código

- JWT_SECRET, JWT_REFRESH_SECRET
- BANCARD_PRIVATE_KEY
- PAGOPAR_TOKEN_PRIVADO
- DATABASE_URL con credenciales
- Credenciales SIFEN
- Claves de email/WhatsApp/SMS

import jwt from 'jsonwebtoken';

function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} es obligatorio y no tiene valor por defecto. ` +
        'Definilo en el entorno con al menos 32 caracteres aleatorios e independientes entre sí.'
    );
  }
  return value;
}

const JWT_SECRET = requireSecret('JWT_SECRET');
const JWT_REFRESH_SECRET = requireSecret('JWT_REFRESH_SECRET');
const JWT_EXPIRATION = '8h';
const REFRESH_EXPIRATION = '7d';

export interface JwtPayload {
  userId: number;
  email: string;
  rolNombre: string;
  sucursalId: number | null;
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRATION });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
}

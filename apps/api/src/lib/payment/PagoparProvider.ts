import crypto from 'crypto';
import { PaymentProvider, IniciarPagoParams, IniciarPagoResult, ConfirmarPagoResult } from './PaymentProvider';
import { logger } from '../logger';

const TOKEN_PUBLICO = process.env.PAGOPAR_TOKEN_PUBLICO ?? '';
const TOKEN_PRIVADO = process.env.PAGOPAR_TOKEN_PRIVADO ?? '';
const SANDBOX = !TOKEN_PUBLICO || !TOKEN_PRIVADO;

const PAGOPAR_API_URL = 'https://api.pagopar.com/api';

/**
 * Calcula el hash de seguridad Pagopar para crear orden:
 * SHA1(token_privado + monto + referencia)
 */
function calcularHash(monto: string, referencia: string): string {
  const raw = `${TOKEN_PRIVADO}${monto}${referencia}`;
  return crypto.createHash('sha1').update(raw).digest('hex');
}

/**
 * Verifica el hash del webhook Pagopar:
 * SHA256(token_privado + monto + referencia)
 */
function verificarHashWebhook(
  tokenPrivado: string,
  monto: string,
  referencia: string,
  hashRecibido: string
): boolean {
  const raw = `${tokenPrivado}${monto}${referencia}`;
  const esperado = crypto.createHash('sha256').update(raw).digest('hex');
  return esperado === hashRecibido;
}

export const PagoparProvider: PaymentProvider = {
  nombre: 'PAGOPAR',

  async iniciarPago(params: IniciarPagoParams): Promise<IniciarPagoResult> {
    const referencia = `PP_${params.pagoId}_${Date.now()}`;
    const montoStr = params.monto.toString();
    const hash = calcularHash(montoStr, referencia);

    const requestPayload: Record<string, unknown> = {
      token_publico: TOKEN_PUBLICO,
      hash,
      monto: montoStr,
      referencia,
      descripcion: params.descripcion.substring(0, 200),
      url_retorno: params.returnUrl,
      url_cancelar: params.cancelUrl,
    };

    if (SANDBOX) {
      logger.info('PagoparProvider modo sandbox — respuesta simulada', { referencia });
      return {
        redirect_url: `https://checkout.pagopar.com/sandbox?ref=${referencia}`,
        referencia_externa: referencia,
        request_payload: requestPayload,
        response_payload: {
          respuesta: 'OK',
          referencia,
          sandbox: true,
        },
      };
    }

    // Modo real: llamada a la API de Pagopar
    const response = await fetch(`${PAGOPAR_API_URL}/comercios/ordenes/crear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });

    const data = (await response.json()) as Record<string, unknown>;
    logger.info('PagoparProvider respuesta de iniciarPago', { referencia, status: response.status });

    if (!response.ok || (data as { respuesta?: string }).respuesta !== 'OK') {
      throw new Error(`Pagopar rechazó la solicitud: ${JSON.stringify(data)}`);
    }

    const redirectUrl = (data as { url_pago?: string }).url_pago ?? `${PAGOPAR_API_URL}/pagar?ref=${referencia}`;

    return {
      redirect_url: redirectUrl,
      referencia_externa: referencia,
      request_payload: requestPayload,
      response_payload: data,
    };
  },

  async procesarWebhook(payload: unknown): Promise<ConfirmarPagoResult> {
    const body = payload as {
      id_transaccion?: string;
      resultado?: string;
      monto?: string;
      referencia?: string;
      hash?: string;
      public_key?: string;
    };

    const referencia = body.referencia ?? body.id_transaccion ?? '';
    const monto = body.monto ?? '0';
    const hash = body.hash ?? '';

    // Verificar hash en modo real. La AUSENCIA de hash debe tratarse como fallo
    // (antes '&& hash' permitía omitir la firma simplemente no enviándola).
    if (!SANDBOX && (!hash || !verificarHashWebhook(TOKEN_PRIVADO, monto, referencia, hash))) {
      logger.warn('PagoparProvider hash de webhook ausente o inválido', { referencia });
      return {
        exitoso: false,
        referencia_externa: referencia,
        response_payload: { error: 'hash_invalido' },
      };
    }

    const exitoso = body.resultado === 'APROBADO';
    const montoConfirmado = monto && monto !== '0' ? BigInt(monto) : undefined;

    return {
      exitoso,
      referencia_externa: referencia,
      monto_confirmado: montoConfirmado,
      response_payload: body as Record<string, unknown>,
    };
  },
};

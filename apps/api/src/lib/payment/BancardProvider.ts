import crypto from 'crypto';
import { PaymentProvider, IniciarPagoParams, IniciarPagoResult, ConfirmarPagoResult } from './PaymentProvider';
import { logger } from '../logger';

const PRIVATE_KEY = process.env.BANCARD_PRIVATE_KEY ?? '';
const PUBLIC_KEY = process.env.BANCARD_PUBLIC_KEY ?? '';
const SANDBOX = process.env.BANCARD_SANDBOX === 'true' || !PRIVATE_KEY || !PUBLIC_KEY;

const BANCARD_BASE_URL = SANDBOX
  ? 'https://vpos.infonet.com.py:8888'
  : 'https://vpos.infonet.com.py';

/**
 * Calcula el token de seguridad Bancard:
 * MD5(private_key + shop_process_id + "new_charge" + amount + currency)
 */
function calcularTokenNuevaCobro(shopProcessId: string, monto: bigint): string {
  const amount = (Number(monto) / 100).toFixed(2); // Bancard espera el monto en formato X.XX
  const raw = `${PRIVATE_KEY}${shopProcessId}new_charge${amount}PYG`;
  return crypto.createHash('md5').update(raw).digest('hex');
}

/**
 * Verifica el token de confirmación del webhook Bancard:
 * MD5(private_key + shop_process_id + "confirm" + amount + currency)
 * (mismo esquema que el token de "new_charge", con la acción "confirm").
 * El token recibido NO debe ser una entrada del hash; se compara contra el
 * valor recalculado localmente a partir de datos que solo conoce el comercio.
 */
function verificarTokenConfirmacion(
  shopProcessId: string,
  amount: string,
  tokenRecibido: string
): boolean {
  const raw = `${PRIVATE_KEY}${shopProcessId}confirm${amount}PYG`;
  const esperado = crypto.createHash('md5').update(raw).digest('hex');
  return esperado === tokenRecibido;
}

export const BancardProvider: PaymentProvider = {
  nombre: 'BANCARD',

  async iniciarPago(params: IniciarPagoParams): Promise<IniciarPagoResult> {
    const shopProcessId = `${params.pagoId}_${Date.now()}`;
    // Bancard usa montos en guaraníes sin decimales como entero, formateado como string con 2 decimales
    const montoFormateado = (Number(params.monto) / 100).toFixed(2);

    const requestPayload: Record<string, unknown> = {
      public_key: PUBLIC_KEY,
      operation: {
        token: calcularTokenNuevaCobro(shopProcessId, params.monto),
        shop_process_id: shopProcessId,
        currency: 'PYG',
        amount: montoFormateado,
        additional_data: '',
        description: params.descripcion.substring(0, 100),
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
      },
    };

    if (SANDBOX) {
      logger.info('BancardProvider modo sandbox — respuesta simulada', { shopProcessId });
      return {
        redirect_url: `${BANCARD_BASE_URL}/vpos/api/0.3/form?process_id=${shopProcessId}`,
        referencia_externa: shopProcessId,
        request_payload: requestPayload,
        response_payload: {
          status: 'success',
          process_id: shopProcessId,
          sandbox: true,
        },
      };
    }

    // Modo real: llamada a la API de Bancard
    const response = await fetch(`${BANCARD_BASE_URL}/vpos/api/0.3/charges/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });

    const data = (await response.json()) as Record<string, unknown>;
    logger.info('BancardProvider respuesta de iniciarPago', { shopProcessId, status: response.status });

    if (!response.ok || (data as { status?: string }).status !== 'success') {
      throw new Error(`Bancard rechazó la solicitud: ${JSON.stringify(data)}`);
    }

    return {
      redirect_url: `${BANCARD_BASE_URL}/vpos/api/0.3/form?process_id=${shopProcessId}`,
      referencia_externa: shopProcessId,
      request_payload: requestPayload,
      response_payload: data,
    };
  },

  async procesarWebhook(payload: unknown): Promise<ConfirmarPagoResult> {
    const body = payload as {
      operation?: {
        response_code?: string;
        authorization_number?: string;
        amount_detail?: { amount?: string };
        token?: string;
        operation_id?: string;
        shop_process_id?: string;
      };
    };

    const operation = body.operation ?? {};
    const shopProcessId = operation.shop_process_id ?? '';
    const token = operation.token ?? '';
    const montoStr = operation.amount_detail?.amount;

    // Verificación de firma en modo real. La ausencia de token = rechazo.
    if (!SANDBOX && (!token || !verificarTokenConfirmacion(shopProcessId, montoStr ?? '', token))) {
      logger.warn('BancardProvider firma de webhook ausente o inválida', { shopProcessId });
      return {
        exitoso: false,
        referencia_externa: shopProcessId,
        response_payload: { error: 'firma_invalida' },
      };
    }

    const exitoso = operation.response_code === '00';
    const montoConfirmado = montoStr
      ? BigInt(Math.round(parseFloat(montoStr) * 100))
      : undefined;

    return {
      exitoso,
      referencia_externa: shopProcessId,
      monto_confirmado: montoConfirmado,
      response_payload: body as Record<string, unknown>,
    };
  },
};

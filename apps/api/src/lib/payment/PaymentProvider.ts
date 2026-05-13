export interface IniciarPagoParams {
  pagoId: number;
  monto: bigint; // en Guaraníes
  descripcion: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface IniciarPagoResult {
  redirect_url: string;
  referencia_externa: string;
  request_payload: Record<string, unknown>;
  response_payload: Record<string, unknown>;
}

export interface ConfirmarPagoResult {
  exitoso: boolean;
  referencia_externa: string;
  monto_confirmado?: bigint;
  response_payload: Record<string, unknown>;
}

export interface PaymentProvider {
  nombre: string;
  iniciarPago(params: IniciarPagoParams): Promise<IniciarPagoResult>;
  procesarWebhook(payload: unknown): Promise<ConfirmarPagoResult>;
}

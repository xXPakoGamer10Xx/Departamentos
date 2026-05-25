// URL del backend: cambia esto en producción al dominio/IP de tu VPS
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  total?: number;
  cuotas?: any[];
  total_extra?: number;
  periodo?: string;
}

class ApiService {
  private baseUrl: string;
  private token: string | null = null;
  // Callback inyectado desde _layout para redirigir al login sin depender del router aquí
  onUnauthorized: (() => void) | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private clearSession() {
    this.token = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: object,
    params?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    let url = `${this.baseUrl}${path}`;

    if (params) {
      const query = new URLSearchParams(params).toString();
      url += `?${query}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      // Token expirado o inválido → limpiar sesión y redirigir al login
      if (response.status === 401) {
        this.clearSession();
        this.onUnauthorized?.();
      }
      throw new Error(data.message || `Error ${response.status}`);
    }

    return data;
  }

  // Auth
  login = (email: string, password: string) =>
    this.request<{ token: string; user: any }>('POST', '/auth/login', { email, password });

  register = (data: { email: string; password: string; nombre_completo: string; rol: string; invite_code?: string }) =>
    this.request<{ token: string; user: any }>('POST', '/auth/register', data);

  me = () => this.request<any>('GET', '/auth/me');

  changePassword = (passwordActual: string, passwordNueva: string) =>
    this.request<void>('POST', '/auth/change-password', { passwordActual, passwordNueva });

  // Inquilinos
  getMiDepto = () =>
    this.request<any>('GET', '/inquilinos/mi-depto');

  getInquilinos = (params?: { search?: string; estado?: string; depto?: string }) =>
    this.request<any[]>('GET', '/inquilinos', undefined, params as any);

  getInquilinoById = (id: string) =>
    this.request<any>('GET', `/inquilinos/${id}`);

  createInquilino = (data: object) =>
    this.request<any>('POST', '/inquilinos', data);

  updateInquilino = (id: string, data: object) =>
    this.request<any>('PUT', `/inquilinos/${id}`, data);

  deleteInquilino = (id: string) =>
    this.request<void>('DELETE', `/inquilinos/${id}`);

  vincularUsuario = (inquilinoId: string, usuarioId: string | null) =>
    this.request<any>('PUT', `/inquilinos/${inquilinoId}/vincular-usuario`, { usuario_id: usuarioId });

  getContratoPdfUrl = (id: string) => `${this.baseUrl}/inquilinos/${id}/pdf`;
  
  getToken = () => this.token;
  getBaseUrl = () => this.baseUrl;
  registerPushToken = (token: string) =>
    this.request<void>('POST', '/push/token', { token });

  // Notificaciones
  getNotificaciones = () =>
    this.request<any[]>('GET', '/notificaciones');

  marcarNotificacionesLeidas = () =>
    this.request<{ success: boolean; message: string }>('PUT', '/notificaciones/marcar-leidas');

  marcarNotificacionLeida = (id: string) =>
    this.request<any>('PUT', `/notificaciones/${id}/leida`);

  // Departamentos
  getDepartamentos = () =>
    this.request<any[]>('GET', '/departamentos');

  getDepartamentosStats = () =>
    this.request<any>('GET', '/departamentos/stats');

  getDepartamentoByNumero = (numero: number) =>
    this.request<any>('GET', `/departamentos/${numero}`);

  updateDepartamento = (numero: number, data: object) =>
    this.request<any>('PUT', `/departamentos/${numero}`, data);

  createDepartamento = (data: object) =>
    this.request<any>('POST', '/departamentos', data);

  deleteDepartamento = (numero: number) =>
    this.request<void>('DELETE', `/departamentos/${numero}`);

  // Usuarios
  getUsuarios = () =>
    this.request<any[]>('GET', '/usuarios');

  createUsuario = (data: object) =>
    this.request<any>('POST', '/usuarios', data);

  toggleUsuario = (id: string) =>
    this.request<any>('PUT', `/usuarios/${id}/toggle`);

  updatePerfil = (data: object) =>
    this.request<any>('PATCH', '/usuarios/perfil', data);

  // Backups
  getBackups = () =>
    this.request<any[]>('GET', '/backups');

  createManualBackup = () =>
    this.request<any>('POST', '/backups/manual');

  // Config
  getConfig = () =>
    this.request<Record<string, string>>('GET', '/config');

  updateConfig = (data: object) =>
    this.request<void>('PUT', '/config', data);

  // Tickets
  getTickets = (params?: { estado?: string }) =>
    this.request<any[]>('GET', '/tickets', undefined, params as any);

  createTicket = (data: { titulo: string; descripcion: string; inquilino_id?: string }) =>
    this.request<any>('POST', '/tickets', data);

  updateTicket = (id: string, data: { estado?: string; nota_admin?: string }) =>
    this.request<any>('PATCH', `/tickets/${id}`, data);

  deleteTicket = (id: string) =>
    this.request<void>('DELETE', `/tickets/${id}`);

  // Cuotas extra
  getCuotas = (params?: { inquilino_id?: string; estado?: string }) =>
    this.request<any[]>('GET', '/cuotas', undefined, params as any);

  createCuota = (data: { inquilino_id: string; concepto: string; monto: number }) =>
    this.request<any>('POST', '/cuotas', data);

  deleteCuota = (id: string) =>
    this.request<void>('DELETE', `/cuotas/${id}`);

  // Pagos
  generarQrPago = (inquilino_id: string) =>
    this.request<any>('POST', `/pagos/generar-qr/${inquilino_id}`);

  getEstadoPago = (inquilino_id: string) =>
    this.request<any>('GET', `/pagos/estado/${inquilino_id}`);

  getPagoByToken = (token: string) =>
    this.request<any>('GET', `/pagos/info/${token}`);

  confirmarPago = (token: string) =>
    this.request<any>('POST', `/pagos/confirmar/${token}`);

  subirComprobante = (inquilino_id: string, comprobante_url: string) =>
    this.request<any>('POST', `/pagos/comprobante/${inquilino_id}`, { comprobante_url });

  confirmarPagoPorId = (pago_id: string) =>
    this.request<any>('POST', `/pagos/confirmar-admin/${pago_id}`);

  getHistorialPagos = (inquilino_id: string) =>
    this.request<any[]>('GET', `/pagos/historial/${inquilino_id}`);

  getTicketsHistorial = (mes: string, estado?: string) =>
    this.request<any[]>('GET', '/tickets', undefined, { mes, ...(estado ? { estado } : {}) } as any);
}

export const api = new ApiService(API_URL);
export default api;

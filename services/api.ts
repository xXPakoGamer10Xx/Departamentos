// URL del backend: cambia esto en producción al dominio/IP de tu VPS
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  total?: number;
}

class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
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
      throw new Error(data.message || `Error ${response.status}`);
    }

    return data;
  }

  // Auth
  login = (email: string, password: string) =>
    this.request<{ token: string; user: any }>('POST', '/auth/login', { email, password });

  me = () => this.request<any>('GET', '/auth/me');

  changePassword = (passwordActual: string, passwordNueva: string) =>
    this.request<void>('POST', '/auth/change-password', { passwordActual, passwordNueva });

  // Inquilinos
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

  getContratoPdfUrl = (id: string) => `${this.baseUrl}/inquilinos/${id}/pdf`;
  
  getToken = () => this.token;

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

  // Pagos
  generarQrPago = (inquilino_id: string) =>
    this.request<any>('POST', `/pagos/generar-qr/${inquilino_id}`);

  getEstadoPago = (inquilino_id: string) =>
    this.request<any>('GET', `/pagos/estado/${inquilino_id}`);

  getPagoByToken = (token: string) =>
    this.request<any>('GET', `/pagos/info/${token}`);

  confirmarPago = (token: string) =>
    this.request<any>('POST', `/pagos/confirmar/${token}`);
}

export const api = new ApiService(API_URL);
export default api;

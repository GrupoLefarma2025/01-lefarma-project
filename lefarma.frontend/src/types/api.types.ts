// Tipos para respuestas de la API

export interface ErrorDetail {
  code: string;
  description: string;
  field?: string | null;
}

export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
  errors?: ErrorDetail[];
}

export interface ApiError {
  message: string;
  errors?: ErrorDetail[];
  statusCode: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

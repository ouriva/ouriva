// API Response Types
// ==================
// Consistent response shapes used across all API endpoints.
// Having shared types ensures the frontend always knows what
// shape to expect from the backend.

// Paginated list response — used by all list endpoints
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error response — consistent error shape across all endpoints
export interface ApiError {
  error: {
    message: string;
    code: string;
    details?: Record<string, string[]>; // field-level validation errors
  };
}

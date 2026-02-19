const baseUrl = import.meta.env.VITE_API_URL ?? '';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export class ApiError extends Error {
  status: number;
  body?: { error?: string; message?: string };
  constructor(
    message: string,
    status: number,
    body?: { error?: string; message?: string }
  ) {
    super(body?.error ?? body?.message ?? message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token = getToken(), ...init } = options;
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let body: { error?: string; message?: string } | undefined;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }
  if (!res.ok) {
    throw new ApiError(
      body?.error ?? body?.message ?? res.statusText,
      res.status,
      body
    );
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface TaskListResponse {
  data: Task[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateTaskBody {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  due_date?: string | null;
}

export interface UpdateTaskBody {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  due_date?: string | null;
}

export const auth = {
  login(email: string, password: string) {
    return request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      token: null,
    });
  },

  register(email: string, password: string, name?: string) {
    return request<User>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name: name || undefined }),
      token: null,
    });
  },

  me() {
    return request<User>('/api/auth/me');
  },
};

export const tasks = {
  list(params?: { status?: string; priority?: string; page?: number; limit?: number }) {
    const sp = new URLSearchParams();
    if (params?.status) sp.set('status', params.status);
    if (params?.priority) sp.set('priority', params.priority);
    if (params?.page != null) sp.set('page', String(params.page));
    if (params?.limit != null) sp.set('limit', String(params.limit));
    const q = sp.toString();
    return request<TaskListResponse>(`/api/tasks${q ? `?${q}` : ''}`);
  },

  get(id: string) {
    return request<Task>(`/api/tasks/${id}`);
  },

  create(body: CreateTaskBody) {
    return request<Task>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  update(id: string, body: UpdateTaskBody) {
    return request<Task>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  delete(id: string) {
    return request<void>(`/api/tasks/${id}`, { method: 'DELETE' });
  },
};

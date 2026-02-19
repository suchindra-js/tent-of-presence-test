import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  tasks as tasksApi,
  type Task,
  ApiError,
} from '../api/client';

const STATUSES = ['todo', 'in_progress', 'done'] as const;
const PRIORITIES = ['low', 'medium', 'high'] as const;

type Status = (typeof STATUSES)[number];
type Priority = (typeof PRIORITIES)[number];

interface TaskFormState {
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  due_date: string;
}

const defaultForm: TaskFormState = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  due_date: '',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

function TaskModal({
  title,
  initial,
  onClose,
  onSave,
  loading,
  error,
}: {
  title: string;
  initial: TaskFormState;
  onClose: () => void;
  onSave: (data: TaskFormState) => void;
  loading: boolean;
  error: string;
}) {
  const [form, setForm] = useState<TaskFormState>(initial);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div className="bg-white rounded-t-2xl sm:rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        <div className="p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.title.trim()) return;
              onSave(form);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 touch-manipulation"
                placeholder="Task title"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full min-h-[88px] px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 touch-manipulation"
                placeholder="Optional description"
                disabled={loading}
              />
            </div>
            {/* Mobile: button groups avoid native select issues inside scrollable modal */}
            <div className="space-y-4 sm:hidden">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, status: s }))}
                      disabled={loading}
                      className={`min-h-[44px] flex-1 min-w-0 px-3 py-2 rounded-md text-sm font-medium touch-manipulation transition-colors ${
                        form.status === s
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                      }`}
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, priority: p }))}
                      disabled={loading}
                      className={`min-h-[44px] flex-1 min-w-0 px-3 py-2 rounded-md text-sm font-medium touch-manipulation transition-colors ${
                        form.priority === p
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* Desktop: native selects */}
            <div className="hidden sm:grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Status }))}
                  className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={loading}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Priority }))}
                  className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={loading}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due date
              </label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 touch-manipulation"
                disabled={loading}
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 touch-manipulation"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !form.title.trim()}
                className="min-h-[44px] px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 flex items-center justify-center gap-2 touch-manipulation"
              >
                {loading && (
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                )}
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function taskToForm(t: Task): TaskFormState {
  return {
    title: t.title,
    description: t.description ?? '',
    status: t.status as Status,
    priority: t.priority as Priority,
    due_date: t.due_date ? t.due_date.slice(0, 10) : '',
  };
}

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [modal, setModal] = useState<'create' | Task | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Task | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const res = await tasksApi.list({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      });
      setTasks(res.data);
    } catch (err) {
      setListError(
        err instanceof ApiError ? err.message : 'Could not load tasks.'
      );
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const openCreate = () => {
    setModal('create');
    setModalError('');
  };
  const openEdit = (task: Task) => {
    setModal(task);
    setModalError('');
  };
  const closeModal = () => {
    setModal(null);
    setModalError('');
  };

  const handleSaveCreate = async (data: TaskFormState) => {
    setModalLoading(true);
    setModalError('');
    try {
      await tasksApi.create({
        title: data.title.trim(),
        description: data.description.trim() || undefined,
        status: data.status,
        priority: data.priority,
        due_date: data.due_date || null,
      });
      closeModal();
      fetchTasks();
    } catch (err) {
      setModalError(
        err instanceof ApiError ? err.message : 'Failed to create task.'
      );
    } finally {
      setModalLoading(false);
    }
  };

  const handleSaveEdit = async (data: TaskFormState) => {
    const task = typeof modal === 'object' ? modal : null;
    if (!task) return;
    setModalLoading(true);
    setModalError('');
    try {
      await tasksApi.update(task.id, {
        title: data.title.trim(),
        description: data.description.trim() || undefined,
        status: data.status,
        priority: data.priority,
        due_date: data.due_date || null,
      });
      closeModal();
      fetchTasks();
    } catch (err) {
      setModalError(
        err instanceof ApiError ? err.message : 'Failed to update task.'
      );
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (task: Task) => {
    setDeleteConfirm(null);
    try {
      await tasksApi.delete(task.id);
      fetchTasks();
    } catch {
      setListError('Failed to delete task.');
    }
  };

  const handleMarkComplete = async (task: Task) => {
    if (task.status === 'done') return;
    setCompletingId(task.id);
    try {
      await tasksApi.update(task.id, { status: 'done' });
      fetchTasks();
    } catch {
      setListError('Failed to update task.');
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <div className="min-h-dvh bg-gray-100 pb-[env(safe-area-inset-bottom)]">
      <header className="bg-white shadow-sm border-b border-gray-200 pt-[env(safe-area-inset-top)]">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 sm:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">Task Dashboard</h1>
            <p className="text-xs sm:text-sm text-gray-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="self-stretch sm:self-center min-h-[44px] px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 active:bg-gray-100 touch-manipulation"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 sm:py-6 sm:px-6">
        {listError && (
          <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm flex justify-between items-center">
            <span>{listError}</span>
            <button
              onClick={() => setListError('')}
              className="text-red-600 hover:text-red-800"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-none sm:gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-h-[44px] w-full sm:w-auto sm:min-w-[140px] px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 touch-manipulation"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="min-h-[44px] w-full sm:w-auto sm:min-w-[140px] px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 touch-manipulation"
            >
              <option value="">All priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={openCreate}
            className="min-h-[44px] w-full sm:w-auto px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 active:bg-indigo-800 touch-manipulation"
          >
            New task
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 bg-gray-200 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500">No tasks yet.</p>
            <button
              onClick={openCreate}
              className="mt-2 text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Create your first task
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
              >
                <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`font-medium wrap-break-word ${
                          task.status === 'done' ? 'line-through text-gray-500' : 'text-gray-900'
                        }`}
                      >
                        {task.title}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded shrink-0 ${
                          task.status === 'todo'
                            ? 'bg-gray-100 text-gray-700'
                            : task.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {task.status.replace('_', ' ')}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded shrink-0 ${
                          task.priority === 'low'
                            ? 'bg-gray-100 text-gray-600'
                            : task.priority === 'medium'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                    {task.description && (
                      <p className="mt-1 text-sm text-gray-600 line-clamp-2 wrap-break-word">
                        {task.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      Due: {formatDate(task.due_date)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0 sm:mt-0 sm:flex-nowrap">
                    {task.status !== 'done' && (
                      <button
                        onClick={() => handleMarkComplete(task)}
                        disabled={completingId === task.id}
                        className="min-h-[44px] min-w-[44px] flex-1 sm:flex-none px-3 py-2 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200 active:bg-green-300 disabled:opacity-50 touch-manipulation"
                      >
                        {completingId === task.id ? '…' : 'Complete'}
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(task)}
                      className="min-h-[44px] min-w-[44px] flex-1 sm:flex-none px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 active:bg-gray-300 touch-manipulation"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(task)}
                      className="min-h-[44px] min-w-[44px] flex-1 sm:flex-none px-3 py-2 text-xs font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 active:bg-red-300 touch-manipulation"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {modal === 'create' && (
        <TaskModal
          title="New task"
          initial={defaultForm}
          onClose={closeModal}
          onSave={handleSaveCreate}
          loading={modalLoading}
          error={modalError}
        />
      )}
      {modal && typeof modal === 'object' && (
        <TaskModal
          title="Edit task"
          initial={taskToForm(modal)}
          onClose={closeModal}
          onSave={handleSaveEdit}
          loading={modalLoading}
          error={modalError}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-lg shadow-xl p-4 sm:p-6 pb-[env(safe-area-inset-bottom)]">
            {/* Bottom sheet handle (mobile) */}
            <div className="sm:hidden flex justify-center pt-1 pb-2 -mt-1">
              <span className="w-10 h-1 rounded-full bg-gray-300" aria-hidden />
            </div>
            <p className="text-gray-900 font-medium">Delete this task?</p>
            <p className="mt-1 text-sm text-gray-500 wrap-break-word">{deleteConfirm.title}</p>
            <div className="mt-4 flex flex-row gap-3 justify-stretch sm:justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="min-h-[44px] flex-1 sm:flex-none px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 active:bg-gray-100 touch-manipulation"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="min-h-[44px] flex-1 sm:flex-none px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 active:bg-red-800 touch-manipulation"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

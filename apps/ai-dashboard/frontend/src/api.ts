export type User = {
	id: string;
	email: string;
	name: string;
};

export type Workspace = {
	id: string;
	name: string;
	createdAt: string;
	updatedAt: string;
};

export type WorkspaceFile = {
	path: string;
	size: number;
	updatedAt: string;
};

export type ChatResponse = {
	sessionId: string;
	message: {
		id: string;
		role: 'assistant';
		content: string;
		createdAt: string;
	};
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
	const response = await fetch(path, {
		...options,
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			...options.headers
		}
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({ message: response.statusText }));
		throw new Error(error.message ?? 'Request failed');
	}

	return response.json() as Promise<T>;
}

export const api = {
	me: () => request<{ user: User | null }>('/api/auth/me'),
	register: (input: { name: string; email: string; password: string }) => request<{ user: User }>('/api/auth/register', {
		method: 'POST',
		body: JSON.stringify(input)
	}),
	login: (input: { email: string; password: string }) => request<{ user: User }>('/api/auth/login', {
		method: 'POST',
		body: JSON.stringify(input)
	}),
	logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
	listWorkspaces: () => request<{ workspaces: Workspace[] }>('/api/workspaces'),
	createWorkspace: (name: string) => request<{ workspace: Workspace }>('/api/workspaces', {
		method: 'POST',
		body: JSON.stringify({ name })
	}),
	listFiles: (workspaceId: string) => request<{ files: WorkspaceFile[] }>(`/api/workspaces/${workspaceId}/files`),
	readFile: (workspaceId: string, filePath: string) => request<{ path: string; content: string }>(`/api/workspaces/${workspaceId}/files/content?path=${encodeURIComponent(filePath)}`),
	saveFile: (workspaceId: string, filePath: string, content: string) => request<{ path: string; contentHash: string; size: number }>(`/api/workspaces/${workspaceId}/files/content`, {
		method: 'PUT',
		body: JSON.stringify({ path: filePath, content })
	}),
	createIndexJobs: (workspaceId: string, files: Array<{ path: string; chunks: string[]; chunkCount: number }>) => request<{ files: Array<{ path: string; chunkCount: number }> }>(`/api/workspaces/${workspaceId}/index-jobs`, {
		method: 'POST',
		body: JSON.stringify({ files })
	}),
	chat: (input: { workspaceId?: string; sessionId?: string; message: string }) => request<ChatResponse>('/api/chat', {
		method: 'POST',
		body: JSON.stringify(input)
	})
};

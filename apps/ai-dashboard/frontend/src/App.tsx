import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react';
import Editor from '@monaco-editor/react';
import { api, type User, type Workspace, type WorkspaceFile } from './api.js';

type ChatMessage = {
	role: 'user' | 'assistant';
	content: string;
};

export function App(): ReactElement {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		api.me()
			.then(result => setUser(result.user))
			.catch(error => setError(error.message))
			.finally(() => setLoading(false));
	}, []);

	if (loading) {
		return <main className="centered">Carregando...</main>;
	}

	if (!user) {
		return <AuthScreen onAuthenticated={setUser} error={error} setError={setError} />;
	}

	return <Dashboard user={user} onLogout={() => setUser(null)} />;
}

function AuthScreen(props: { onAuthenticated: (user: User) => void; error: string | null; setError: (error: string | null) => void }): ReactElement {
	const [mode, setMode] = useState<'login' | 'register'>('login');
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');

	async function submit(event: FormEvent): Promise<void> {
		event.preventDefault();
		props.setError(null);

		try {
			const result = mode === 'login'
				? await api.login({ email, password })
				: await api.register({ name, email, password });
			props.onAuthenticated(result.user);
		} catch (error) {
			props.setError(error instanceof Error ? error.message : 'Falha na autenticacao');
		}
	}

	return (
		<main className="auth-shell">
			<section className="auth-card">
				<p className="eyebrow">Princy Ai</p>
				<h1>{mode === 'login' ? 'Entrar' : 'Criar conta'}</h1>
				<p className="muted">Acesse workspaces, Monaco Editor, chat IA e contexto inteligente do codigo.</p>
				<form onSubmit={submit} className="form">
					{mode === 'register' && (
						<label>
							Nome
							<input value={name} onChange={event => setName(event.target.value)} required />
						</label>
					)}
					<label>
						Email
						<input type="email" value={email} onChange={event => setEmail(event.target.value)} required />
					</label>
					<label>
						Senha
						<input type="password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required />
					</label>
					{props.error && <p className="error">{props.error}</p>}
					<button type="submit">{mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
				</form>
				<button className="link-button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
					{mode === 'login' ? 'Precisa criar uma conta?' : 'Ja tem uma conta?'}
				</button>
			</section>
		</main>
	);
}

function Dashboard(props: { user: User; onLogout: () => void }): ReactElement {
	const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
	const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
	const [workspaceName, setWorkspaceName] = useState('');
	const [files, setFiles] = useState<WorkspaceFile[]>([]);
	const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
	const [content, setContent] = useState('');
	const [status, setStatus] = useState<string | null>(null);
	const selectedWorkspace = useMemo(
		() => workspaces.find(workspace => workspace.id === selectedWorkspaceId) ?? null,
		[workspaces, selectedWorkspaceId]
	);

	useEffect(() => {
		api.listWorkspaces().then(result => {
			setWorkspaces(result.workspaces);
			setSelectedWorkspaceId(result.workspaces[0]?.id ?? null);
		}).catch(error => setStatus(error.message));
	}, []);

	useEffect(() => {
		if (!selectedWorkspaceId) {
			setFiles([]);
			setSelectedFilePath(null);
			setContent('');
			return;
		}

		api.listFiles(selectedWorkspaceId).then(result => {
			setFiles(result.files);
			const firstFilePath = result.files[0]?.path ?? null;
			setSelectedFilePath(firstFilePath);
			if (!firstFilePath) {
				setContent('');
			}
		}).catch(error => setStatus(error.message));
	}, [selectedWorkspaceId]);

	useEffect(() => {
		if (!selectedWorkspaceId || !selectedFilePath) {
			return;
		}

		api.readFile(selectedWorkspaceId, selectedFilePath)
			.then(result => setContent(result.content))
			.catch(error => setStatus(error.message));
	}, [selectedWorkspaceId, selectedFilePath]);

	async function createWorkspace(event: FormEvent): Promise<void> {
		event.preventDefault();
		if (!workspaceName.trim()) {
			return;
		}

		const result = await api.createWorkspace(workspaceName.trim());
		setWorkspaces(current => [result.workspace, ...current]);
		setSelectedWorkspaceId(result.workspace.id);
		setWorkspaceName('');
	}

	async function saveFile(): Promise<void> {
		if (!selectedWorkspaceId || !selectedFilePath) {
			return;
		}

		await api.saveFile(selectedWorkspaceId, selectedFilePath, content);
		setStatus(`Arquivo salvo: ${selectedFilePath}`);
		const result = await api.listFiles(selectedWorkspaceId);
		setFiles(result.files);
	}

	async function logout(): Promise<void> {
		await api.logout();
		props.onLogout();
	}

	return (
		<main className="app-shell">
			<aside className="sidebar">
				<div>
					<p className="eyebrow">Princy Ai</p>
					<h2>{props.user.name}</h2>
					<p className="muted">{props.user.email}</p>
				</div>
				<form onSubmit={createWorkspace} className="workspace-form">
					<input value={workspaceName} onChange={event => setWorkspaceName(event.target.value)} placeholder="Novo workspace" />
					<button type="submit">Criar</button>
				</form>
				<nav className="workspace-list">
					{workspaces.map(workspace => (
						<button
							key={workspace.id}
							className={workspace.id === selectedWorkspaceId ? 'selected' : ''}
							onClick={() => setSelectedWorkspaceId(workspace.id)}
						>
							{workspace.name}
						</button>
					))}
				</nav>
				<button className="secondary-button" onClick={logout}>Sair</button>
			</aside>
			<section className="main-panel">
				<header className="topbar">
					<div>
						<p className="eyebrow">Workspace</p>
						<h1>{selectedWorkspace?.name ?? 'Crie um workspace'}</h1>
					</div>
					{status && <p className="status">{status}</p>}
				</header>
				<div className="workspace-grid">
					<FileExplorer files={files} selectedFilePath={selectedFilePath} onSelect={setSelectedFilePath} />
					<EditorPanel filePath={selectedFilePath} content={content} setContent={setContent} onSave={saveFile} />
					<ChatPanel workspaceId={selectedWorkspaceId} files={files} />
				</div>
			</section>
		</main>
	);
}

function FileExplorer(props: { files: WorkspaceFile[]; selectedFilePath: string | null; onSelect: (path: string) => void }): ReactElement {
	return (
		<section className="file-panel">
			<h2>Arquivos</h2>
			{props.files.length === 0 && <p className="muted">Nenhum arquivo encontrado.</p>}
			{props.files.map(file => (
				<button
					key={file.path}
					className={file.path === props.selectedFilePath ? 'file selected' : 'file'}
					onClick={() => props.onSelect(file.path)}
				>
					<span>{file.path}</span>
					<small>{file.size} bytes</small>
				</button>
			))}
		</section>
	);
}

function EditorPanel(props: { filePath: string | null; content: string; setContent: (content: string) => void; onSave: () => Promise<void> }): ReactElement {
	return (
		<section className="editor-panel">
			<div className="panel-header">
				<h2>{props.filePath ?? 'Nenhum arquivo selecionado'}</h2>
				<button onClick={props.onSave} disabled={!props.filePath}>Salvar</button>
			</div>
			<Editor
				height="calc(100vh - 174px)"
				defaultLanguage="markdown"
				theme="vs-dark"
				value={props.content}
				onChange={value => props.setContent(value ?? '')}
				options={{
					minimap: { enabled: false },
					fontSize: 14,
					wordWrap: 'on'
				}}
			/>
		</section>
	);
}

function ChatPanel(props: { workspaceId: string | null; files: WorkspaceFile[] }): ReactElement {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [message, setMessage] = useState('');
	const [sessionId, setSessionId] = useState<string | undefined>();
	const [status, setStatus] = useState<string | null>(null);

	async function submit(event: FormEvent): Promise<void> {
		event.preventDefault();
		if (!message.trim()) {
			return;
		}

		const userMessage = message.trim();
		setMessages(current => [...current, { role: 'user', content: userMessage }]);
		setMessage('');
		setStatus('Consultando contexto e LLM...');

		try {
			const response = await api.chat({
				workspaceId: props.workspaceId ?? undefined,
				sessionId,
				message: userMessage
			});
			setSessionId(response.sessionId);
			setMessages(current => [...current, { role: 'assistant', content: response.message.content }]);
			setStatus(null);
		} catch (error) {
			setStatus(error instanceof Error ? error.message : 'Falha ao consultar a IA');
		}
	}

	async function indexWorkspace(): Promise<void> {
		if (!props.workspaceId || props.files.length === 0) {
			return;
		}

		setStatus('Preparando chunks...');
		const fileContents = await Promise.all(props.files.map(async file => ({
			path: file.path,
			content: (await api.readFile(props.workspaceId as string, file.path)).content
		})));

		const worker = new Worker(new URL('./indexWorker.ts', import.meta.url), { type: 'module' });
		worker.postMessage({ files: fileContents, chunkSize: 1200 });
		worker.onmessage = async (event: MessageEvent<{ files: Array<{ path: string; chunks: string[]; chunkCount: number }> }>) => {
			try {
				setStatus('Gerando embeddings...');
				const result = await api.createIndexJobs(props.workspaceId as string, event.data.files);
				const chunkCount = result.files.reduce((total, file) => total + file.chunkCount, 0);
				setStatus(`Indexacao concluida: ${chunkCount} chunk(s) em ${result.files.length} arquivo(s)`);
			} catch (error) {
				setStatus(error instanceof Error ? error.message : 'Falha ao indexar workspace');
			} finally {
				worker.terminate();
			}
		};
		worker.onerror = () => {
			setStatus('Falha ao preparar chunks no Web Worker');
			worker.terminate();
		};
	}

	return (
		<section className="chat-panel">
			<div className="panel-header">
				<h2>Chat IA</h2>
				<button onClick={indexWorkspace} disabled={!props.workspaceId || props.files.length === 0}>Indexar</button>
			</div>
			<div className="messages">
				{messages.length === 0 && <p className="muted">Envie uma pergunta sobre o workspace.</p>}
				{messages.map((item, index) => (
					<div key={`${item.role}-${index}`} className={`message ${item.role}`}>
						<strong>{item.role === 'user' ? 'Voce' : 'IA'}</strong>
						<p>{item.content}</p>
					</div>
				))}
			</div>
			{status && <p className="status">{status}</p>}
			<form onSubmit={submit} className="chat-form">
				<textarea value={message} onChange={event => setMessage(event.target.value)} placeholder="Pergunte algo..." />
				<button type="submit">Enviar</button>
			</form>
		</section>
	);
}

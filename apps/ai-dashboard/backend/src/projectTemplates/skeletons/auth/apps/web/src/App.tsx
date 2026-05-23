export default function App() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <form className="p-8 border border-slate-700 rounded-xl w-80">
        <h1 className="text-xl font-bold mb-4">{{PROJECT_NAME}} Login</h1>
        <input className="w-full mb-2 p-2 rounded bg-slate-800" placeholder="email" />
        <input type="password" className="w-full mb-4 p-2 rounded bg-slate-800" placeholder="senha" />
        <button className="w-full py-2 bg-cyan-500 text-black rounded font-semibold">Entrar</button>
      </form>
    </main>
  );
}

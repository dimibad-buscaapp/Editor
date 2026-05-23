import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
const data = [{ name: 'Jan', v: 40 }, { name: 'Fev', v: 55 }, { name: 'Mar', v: 48 }];
export default function App() {
  return (
    <main className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-2xl font-bold mb-6">{{PROJECT_NAME}} Dashboard</h1>
      <div className="h-64 bg-slate-800 rounded-lg p-4">
        <ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid stroke="#334155"/><XAxis dataKey="name" stroke="#94a3b8"/><YAxis stroke="#94a3b8"/><Tooltip/><Line type="monotone" dataKey="v" stroke="#22d3ee"/></LineChart></ResponsiveContainer>
      </div>
    </main>
  );
}

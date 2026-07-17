import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Clients from './pages/Clients';
import CompanySettings from './pages/CompanySettings';

function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen w-full bg-gray-50">
        <aside className="w-64 bg-white border-r flex flex-col p-4">
          <h2 className="font-bold text-xl mb-6 text-gray-800">Taralaya OS</h2>
          <nav className="flex flex-col gap-2">
            <Link to="/clients" className="p-2 hover:bg-gray-100 rounded text-gray-700">Clients</Link>
            <Link to="/settings" className="p-2 hover:bg-gray-100 rounded text-gray-700">Company Settings</Link>
          </nav>
        </aside>
        <main className="flex-1 p-6 overflow-auto">
          <Routes>
            <Route path="/" element={<div className="text-gray-500">Welcome to Taralaya Business OS</div>} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/settings" element={<CompanySettings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;

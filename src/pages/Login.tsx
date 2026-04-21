import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, User, Lock } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const isAuth = localStorage.getItem('admin_auth') === 'true';
    if (isAuth) navigate('/admin');
  }, [navigate]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (username === 'admin' && password === 'admin') {
      setLoading(true);
      localStorage.setItem('admin_auth', 'true');
      window.location.href = '/admin';
    } else {
      setError('Credenciais inválidas. Use admin/admin.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 bg-[radial-gradient(circle_at_50%_50%,rgba(242,202,80,0.05)_0%,transparent_50%)]">
      <div className="w-full max-w-md bg-surface p-12 border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="relative">
            <div className="text-center mb-12">
                <div className="text-2xl font-headline font-black text-primary tracking-tighter uppercase mb-2">
                    PREMIUM <span className="text-white">CAMINHÕES</span>
                </div>
                <p className="text-on-surface-variant font-headline font-bold text-[10px] uppercase tracking-[0.4em]">Painel de Controle</p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-primary tracking-widest flex items-center gap-2">
                        <User size={12} /> Usuário
                    </label>
                    <input 
                        type="text" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-[#2a2a2a] border-none text-white py-4 px-6 outline-none focus:ring-1 focus:ring-primary"
                        placeholder="admin"
                    />
                </div>
                
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-primary tracking-widest flex items-center gap-2">
                        <Lock size={12} /> Senha
                    </label>
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-[#2a2a2a] border-none text-white py-4 px-6 outline-none focus:ring-1 focus:ring-primary"
                        placeholder="admin"
                    />
                </div>

                {error && <p className="text-red-500 text-[10px] font-bold uppercase text-center">{error}</p>}
                
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full industrial-gradient text-black font-headline font-black uppercase tracking-widest py-5 flex items-center justify-center gap-3 hover:scale-[1.02] transition-all shadow-xl shadow-primary/20"
                >
                   {loading ? 'Entrando...' : 'Acessar Painel'} <LogIn size={20} />
                </button>
            </form>
            
            <p className="mt-12 text-on-surface-variant text-[10px] uppercase leading-relaxed tracking-widest text-center">
               Acesso restrito. Use <span className="text-white">admin/admin</span> para testes.
            </p>
        </div>
      </div>
    </div>
  );
}

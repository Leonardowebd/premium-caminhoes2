import { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { Vehicle, Banner, Brand, ContactMessage } from '../types';
import { Truck, Image, Tag, Settings, Plus, Edit2, Trash2, LayoutDashboard, ChevronRight, Save, X, MessageSquare, Mail, Phone, Loader2, Upload, CheckCircle, Users, MapPin, Calendar, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { format, subDays, startOfDay, isAfter } from 'date-fns';
import { motion } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';
import { useForm, Controller } from 'react-hook-form';
import { NumericFormat, PatternFormat } from 'react-number-format';

export default function Admin() {
  const location = useLocation();
  const tabs = [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Veículos', href: '/admin/veiculos', icon: Truck },
    { label: 'Banners', href: '/admin/banners', icon: Image },
    { label: 'Contatos', href: '/admin/contatos', icon: MessageSquare },
    { label: 'Configurações', href: '/admin/configuracoes', icon: Settings },
  ];

  return (
    <div className="pt-24 min-h-screen bg-background flex">
      {/* Sidebar Desktop */}
      <aside className="w-64 border-r border-white/5 bg-surface/50 h-[calc(100vh-96px)] sticky top-24 hidden md:block">
        <div className="p-6">
          <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-8">Gestão Premium</p>
          <div className="space-y-4">
            {tabs.map(tab => {
              const isActive = location.pathname === tab.href;
              return (
                <Link 
                  key={tab.label} 
                  to={tab.href}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3 font-headline font-bold uppercase tracking-tighter text-sm transition-all border-l-4",
                    isActive ? "bg-primary/10 text-primary border-primary" : "text-on-surface-variant border-transparent hover:text-white"
                  )}
                >
                  <tab.icon size={18} /> {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Mobile Admin Nav */}
      <nav className="fixed bottom-0 left-0 w-full bg-surface border-t border-white/5 flex md:hidden z-[100]">
        {tabs.map(tab => {
          const isActive = location.pathname === tab.href;
          return (
            <Link 
              key={tab.label} 
              to={tab.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all",
                isActive ? "text-primary" : "text-on-surface-variant"
              )}
            >
              <tab.icon size={20} />
              <span className="text-[8px] font-bold uppercase tracking-widest">{tab.label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className="flex-grow p-6 md:p-12 pb-24 md:pb-12 overflow-x-hidden">
        <Routes>
          <Route path="/" element={<AdminDashboard />} />
          <Route path="/veiculos" element={<VehicleManager />} />
          <Route path="/banners" element={<BannerManager />} />
          <Route path="/contatos" element={<ContactManager />} />
          <Route path="/configuracoes" element={<SettingsManager />} />
        </Routes>
      </main>
    </div>
  );
}

function AdminDashboard() {
    const [seeding, setSeeding] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');
    const [stats, setStats] = useState({
        vehicles: 0,
        leads: 0,
        banners: 0,
        recentLeads: [] as any[],
        chartData: [] as any[],
        locationData: [] as any[]
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, [timeRange]);

    async function fetchDashboardData() {
        setLoading(true);
        try {
            const [vSnap, cSnap, bSnap, visitSnap] = await Promise.all([
                getDocs(collection(db, 'vehicles')),
                getDocs(query(collection(db, 'contacts'), orderBy('createdAt', 'desc'))),
                getDocs(collection(db, 'banners')),
                getDocs(collection(db, 'visits'))
            ]);

            const now = new Date();
            const filterDate = timeRange === '7d' ? subDays(now, 7) : timeRange === '30d' ? subDays(now, 30) : new Date(0);

            const allLeads = cSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            const filteredLeads = allLeads.filter(l => isAfter(new Date(l.createdAt || 0), filterDate));
            
            const allVisits = visitSnap.docs.map(d => d.data());
            const filteredVisits = allVisits.filter(v => isAfter(new Date(v.createdAt || 0), filterDate));

            // Chart Data (Leads over time)
            const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 14;
            const chartMap: Record<string, number> = {};
            for (let i = 0; i < days; i++) {
                const dateKey = format(subDays(now, i), 'dd/MM');
                chartMap[dateKey] = 0;
            }

            filteredLeads.forEach(l => {
                const dateKey = format(new Date(l.createdAt || 0), 'dd/MM');
                if (chartMap[dateKey] !== undefined) chartMap[dateKey]++;
            });

            const chartData = Object.entries(chartMap)
                .map(([name, value]) => ({ name, value }))
                .reverse();

            // Real Location Data from Visits
            const locMap: Record<string, number> = {};
            filteredVisits.forEach((v: any) => {
                const city = v.city || 'Desconhecido';
                locMap[city] = (locMap[city] || 0) + 1;
            });

            const locationData = Object.entries(locMap)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);

            // Fallback location if none
            if (locationData.length === 0) {
                locationData.push({ name: 'Aguardando Dados', value: 0 });
            }

            setStats({
                vehicles: vSnap.size,
                leads: allLeads.length, // Showing total registrations as requested
                banners: bSnap.size,
                recentLeads: filteredLeads.slice(0, 5),
                chartData,
                locationData
            });
        } catch (err) {
            console.error("Error stats:", err);
        } finally {
            setLoading(false);
        }
    }

    const handleSeed = async () => {
        if (!confirm('LIMPAR e popular dados?')) return;
        setSeeding(true);
        try {
            const cols = ['vehicles', 'brands', 'banners', 'settings'];
            for (const c of cols) {
                const snap = await getDocs(collection(db, c));
                await Promise.all(snap.docs.map(d => deleteDoc(doc(db, c, d.id))));
            }

            const brandsList = ['Scania', 'Volvo', 'Mercedes-Benz', 'Volkswagen', 'Iveco', 'DAF'];
            await Promise.all(brandsList.map(b => addDoc(collection(db, 'brands'), { name: b })));

            await addDoc(collection(db, 'settings'), {
                logoUrl: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?q=80&w=200&auto=format&fit=crop',
                contactPhone: '(77) 9965-0789',
                contactEmail: 'atendimento@premium.com'
            });

            const vData = [
                { brand: 'Scania', model: 'R500 V8', type: 'Caminhão', price: 850000, year: 2021, kilometers: 150000, imageUrl: 'https://images.unsplash.com/photo-1586191582151-f73770425983?q=80&w=800' },
                { brand: 'Volvo', model: 'FH 540', type: 'Caminhão', price: 920000, year: 2022, kilometers: 80000, imageUrl: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=800' },
                { brand: 'Mercedes-Benz', model: 'Actros 2651', type: 'Caminhão', price: 780000, year: 2020, kilometers: 210000, imageUrl: 'https://images.unsplash.com/photo-1591768793355-74d7c836038c?q=80&w=800' }
            ];
            
            await Promise.all(vData.map((v, i) => addDoc(collection(db, 'vehicles'), {
                ...v,
                transmission: 'Automático',
                power: '500 CV',
                traction: '6x4',
                isFeatured: true,
                createdAt: Date.now() - (i * 1000)
            })));

            const bImgs = [
                'https://images.unsplash.com/photo-1586191582151-f73770425983?auto=format&fit=crop&q=80&w=2000',
                'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&q=80&w=2000'
            ];
            await Promise.all(bImgs.map((url, i) => addDoc(collection(db, 'banners'), {
                imageUrl: url,
                title: `Elite Heavy #${i + 1}`,
                order: i,
                link: '/estoque',
                createdAt: Date.now()
            })));

            window.location.reload();
        } catch (err) {
            console.error(err);
            alert('Falha na sincronização.');
        } finally {
            setSeeding(false);
        }
    };

    return (
        <div className="space-y-12 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h1 className="text-4xl md:text-5xl font-headline font-black text-white uppercase tracking-tighter mb-2 italic">
                        Visão <span className="text-primary italic">Geral</span>
                    </h1>
                    <p className="text-on-surface-variant uppercase tracking-[0.3em] text-[10px] font-bold">Painel de Analítica Premium Caminhões</p>
                </div>
                
                <div className="flex items-center gap-4 bg-surface p-1 border border-white/5">
                    {(['7d', '30d', 'all'] as const).map(range => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={cn(
                                "px-4 py-2 text-[10px] font-headline font-black uppercase tracking-widest transition-all",
                                timeRange === range ? "bg-primary text-black" : "text-on-surface-variant hover:text-white"
                            )}
                        >
                            {range === '7d' ? '7 Dias' : range === '30d' ? '30 Dias' : 'Tudo'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Veículos Ativos', value: stats.vehicles, icon: Truck, color: 'text-primary' },
                    { label: 'Leads (Contatos)', value: stats.leads, icon: Users, color: 'text-blue-500' },
                    { label: 'Banners Ativos', value: stats.banners, icon: Image, color: 'text-green-500' },
                    { label: 'Novos Contatos', value: stats.recentLeads.length, icon: TrendingUp, color: 'text-purple-500' }
                ].map((stat, i) => (
                    <div key={i} className="bg-surface p-6 border border-white/5 relative overflow-hidden group">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">{stat.label}</h3>
                                <p className="text-4xl font-headline font-black text-white tracking-tighter">
                                    {loading ? '...' : stat.value}
                                </p>
                            </div>
                            <stat.icon size={24} className={cn(stat.color, "opacity-40 group-hover:opacity-100 transition-opacity")} />
                        </div>
                        <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent w-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                ))}
            </div>

            {/* Main Analytics Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Chart Section */}
                <div className="lg:col-span-2 bg-surface border border-white/5 p-8">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-white font-headline font-black uppercase text-sm tracking-widest border-l-4 border-primary pl-4">Fluxo de Leads</h3>
                        <div className="flex items-center gap-2 text-green-500 text-[10px] font-bold uppercase tracking-widest">
                             <TrendingUp size={14} /> +12% Crescimento
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.chartData}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f2ca50" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#f2ca50" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis 
                                    dataKey="name" 
                                    stroke="#555" 
                                    fontSize={10} 
                                    tickLine={false} 
                                    axisLine={false} 
                                />
                                <YAxis 
                                    stroke="#555" 
                                    fontSize={10} 
                                    tickLine={false} 
                                    axisLine={false} 
                                />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#1a1a1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0' }}
                                    itemStyle={{ color: '#f2ca50', fontWeight: 'bold', fontSize: '12px' }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#f2ca50" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorValue)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Location Breakdowns */}
                <div className="bg-surface border border-white/5 p-8">
                    <h3 className="text-white font-headline font-black uppercase text-sm tracking-widest border-l-4 border-primary pl-4 mb-8">Top Origens (Leads)</h3>
                    <div className="space-y-6">
                        {stats.locationData.map((loc, i) => (
                            <div key={loc.name}>
                                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest mb-2">
                                    <span className="text-white flex items-center gap-2"><MapPin size={12} className="text-primary"/> {loc.name}</span>
                                    <span className="text-on-surface-variant font-headline">{loc.value} contatos</span>
                                </div>
                                <div className="h-1 bg-white/5 w-full overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(loc.value / (stats.leads || 1)) * 100}%` }}
                                        className="h-full bg-primary"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Leads Table */}
            <div className="bg-surface border border-white/5 overflow-hidden">
                <div className="p-8 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-white font-headline font-black uppercase text-sm tracking-widest border-l-4 border-primary pl-4">Entradas Recentes</h3>
                    <Link to="/admin/contatos" className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest">Ver Todos</Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="px-8 py-4 text-[10px] font-bold text-primary uppercase tracking-widest">Lead</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-primary uppercase tracking-widest">WhatsApp</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-primary uppercase tracking-widest text-right">Data</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {stats.recentLeads.map(lead => (
                                <tr key={lead.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-8 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-white font-headline font-bold uppercase text-xs">{lead.name}</span>
                                            <span className="text-[10px] text-on-surface-variant tracking-widest font-body line-clamp-1">{lead.message}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-4 text-[10px] font-body text-on-surface-variant font-bold">{lead.whatsapp}</td>
                                    <td className="px-8 py-4 text-[10px] font-body text-white/40 text-right">
                                        {format(new Date(lead.createdAt || 0), 'dd MMM, HH:mm', { locale: undefined })}
                                    </td>
                                </tr>
                            ))}
                            {stats.recentLeads.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-8 py-10 text-center text-on-surface-variant text-[10px] uppercase font-bold tracking-widest">Nenhum lead no período selecionado</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer Seeding Area (Small) */}
            <div className="flex justify-center pt-12">
               <button 
                  onClick={handleSeed}
                  disabled={seeding}
                  className="text-[9px] text-on-surface-variant/30 hover:text-primary transition-all uppercase font-bold tracking-widest border border-white/5 px-4 py-2"
               >
                  {seeding ? 'PROCESSANDO...' : 'Sincronização Forçada de Dados'}
               </button>
            </div>
        </div>
    );
}

function VehicleManager() {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState<string | null>(null);
    const { register, handleSubmit, reset, setValue, getValues, control } = useForm();

    useEffect(() => {
        fetchVehicles();
    }, []);

    async function fetchVehicles() {
        setLoading(true);
        const snap = await getDocs(collection(db, 'vehicles'));
        setVehicles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle)));
        setLoading(false);
    }

    const onSubmit = async (data: any) => {
        const docData = {
            ...data,
            price: Number(data.price),
            year: Number(data.year),
            kilometers: Number(data.kilometers),
            isFeatured: !!data.isFeatured,
            gallery: data.galleryString?.split('\n').map((s: string) => s.trim()).filter(Boolean) || [],
            updatedAt: serverTimestamp(),
            createdAt: editingVehicle ? editingVehicle.createdAt : Date.now()
        };
        delete (docData as any).galleryString;

        try {
            if (editingVehicle) {
                await updateDoc(doc(db, 'vehicles', editingVehicle.id), docData);
            } else {
                await addDoc(collection(db, 'vehicles'), { ...docData, createdAt: Date.now() });
            }
            setFeedback('Veículo salvo com sucesso!');
            setTimeout(() => setFeedback(null), 3000);
            setIsFormOpen(false);
            setEditingVehicle(null);
            reset();
            fetchVehicles();
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar veículo.");
        }
    };

    const handleEdit = (v: Vehicle) => {
        setEditingVehicle(v);
        reset({
            ...v,
            galleryString: v.gallery?.join('\n') || ''
        });
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este veículo?")) return;
        await deleteDoc(doc(db, 'vehicles', id));
        setFeedback('Veículo excluído!');
        setTimeout(() => setFeedback(null), 3000);
        fetchVehicles();
    };

    return (
        <div className="space-y-12">
            <div className="flex justify-between items-end">
                <div>
                   <h1 className="text-4xl font-headline font-black text-white uppercase tracking-tighter mb-2">Gestão de Veículos</h1>
                   <p className="text-on-surface-variant uppercase tracking-widest text-xs font-bold">Adicione e gerencie o estoque premium.</p>
                </div>
                <button 
                  onClick={() => {setEditingVehicle(null); reset(); setIsFormOpen(true);}}
                  className="industrial-gradient text-black font-headline font-black uppercase text-xs tracking-widest px-8 py-4 flex items-center gap-3 hover:scale-105 transition-all"
                >
                   <Plus size={18} /> Novo Veículo
                </button>
            </div>

            {feedback && (
                <div className="bg-green-500/20 border border-green-500 text-green-500 p-4 font-bold uppercase text-[10px] tracking-widest flex items-center gap-3">
                    <CheckCircle size={16} /> {feedback}
                </div>
            )}

            <div className="bg-surface border border-white/5 overflow-x-auto">
               <table className="w-full text-left">
                  <thead>
                     <tr className="bg-background border-b border-white/10">
                        <th className="px-6 py-4 font-headline uppercase text-xs tracking-widest text-primary">Marca / Modelo</th>
                        <th className="px-6 py-4 font-headline uppercase text-xs tracking-widest text-primary">Preço</th>
                        <th className="px-6 py-4 font-headline uppercase text-xs tracking-widest text-primary">Destaque</th>
                        <th className="px-6 py-4 font-headline uppercase text-xs tracking-widest text-primary text-right">Ações</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                     {vehicles.map(v => (
                        <tr key={v.id} className="hover:bg-white/5 transition-colors">
                           <td className="px-6 py-6 font-headline font-bold uppercase text-sm text-white">
                              {v.brand} {v.model} <span className="block text-[10px] text-on-surface-variant font-normal tracking-widest mt-1">Ano {v.year}</span>
                           </td>
                           <td className="px-6 py-6 font-headline font-bold text-lg text-primary">{formatCurrency(v.price)}</td>
                           <td className="px-6 py-6">
                              {v.isFeatured ? <span className="text-green-500 font-bold text-[10px] uppercase tracking-widest">Sim</span> : <span className="text-on-surface-variant font-bold text-[10px] uppercase tracking-widest">Não</span>}
                           </td>
                           <td className="px-6 py-6 text-right space-x-4">
                              <button onClick={() => handleEdit(v)} className="text-primary hover:text-white transition-colors"><Edit2 size={18} /></button>
                              <button onClick={() => handleDelete(v.id)} className="text-red-500 hover:text-red-400 transition-colors"><Trash2 size={18} /></button>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>

            {isFormOpen && (
               <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6 overflow-y-auto">
                  <div className="bg-surface w-full max-w-4xl p-10 border border-white/10 relative">
                     <button onClick={() => setIsFormOpen(false)} className="absolute top-6 right-6 text-primary"><X /></button>
                     <h2 className="text-2xl font-headline font-black text-white uppercase mb-10 border-l-4 border-primary pl-4">
                        {editingVehicle ? 'Editar Veículo' : 'Novo Veículo'}
                     </h2>
                     
                     <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                           <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-primary tracking-widest">Marca*</label>
                              <input {...register('brand', { required: true })} defaultValue={editingVehicle?.brand} className="w-full bg-[#2a2a2a] border-none text-white py-3 px-4 outline-none" />
                           </div>
                           <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-primary tracking-widest">Modelo*</label>
                              <input {...register('model', { required: true })} defaultValue={editingVehicle?.model} className="w-full bg-[#2a2a2a] border-none text-white py-3 px-4 outline-none" />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                 <label className="text-[10px] font-bold uppercase text-primary tracking-widest">Ano*</label>
                                 <Controller
                                    name="year"
                                    control={control}
                                    rules={{ required: true }}
                                    defaultValue={editingVehicle?.year}
                                    render={({ field }) => (
                                       <PatternFormat
                                          value={field.value}
                                          onValueChange={(values) => field.onChange(values.floatValue)}
                                          className="w-full bg-[#2a2a2a] border-none text-white py-3 px-4 outline-none"
                                          format="####"
                                          mask="_"
                                          placeholder="Ex: 2024"
                                       />
                                    )}
                                 />
                              </div>
                              <div className="space-y-1">
                                 <label className="text-[10px] font-bold uppercase text-primary tracking-widest">Preço*</label>
                                 <Controller
                                    name="price"
                                    control={control}
                                    rules={{ required: true }}
                                    defaultValue={editingVehicle?.price}
                                    render={({ field }) => (
                                       <NumericFormat
                                          value={field.value}
                                          onValueChange={(values) => field.onChange(values.floatValue)}
                                          className="w-full bg-[#2a2a2a] border-none text-white py-3 px-4 outline-none"
                                          thousandSeparator="."
                                          decimalSeparator=","
                                          prefix="R$ "
                                          decimalScale={2}
                                          fixedDecimalScale
                                          placeholder="R$ 0,00"
                                       />
                                    )}
                                 />
                              </div>
                           </div>
                           <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-primary tracking-widest">URL da Imagem Principal*</label>
                              <input {...register('imageUrl', { required: true })} defaultValue={editingVehicle?.imageUrl} className="w-full bg-[#2a2a2a] border-none text-white py-3 px-4 outline-none mb-2" />
                              <MediaUpload 
                                label="Ou suba a mídia principal" 
                                folder="vehicles" 
                                onUpload={(url) => setValue('imageUrl', url)} 
                              />
                           </div>
                           <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-primary tracking-widest">Imagens Adicionais (Galeria) - Uma URL por linha</label>
                              <textarea 
                                 {...register('galleryString')} 
                                 defaultValue={editingVehicle?.gallery?.join('\n')} 
                                 className="w-full bg-[#2a2a2a] border-none text-white py-3 px-4 outline-none h-24 resize-none mb-2" 
                                 placeholder="https://...&#10;https://..."
                              />
                              <MediaUpload 
                                label="Ou adicione mídia à galeria" 
                                folder="vehicles/gallery" 
                                onUpload={(url) => {
                                    const current = getValues('galleryString') || '';
                                    setValue('galleryString', current + (current ? '\n' : '') + url);
                                }} 
                              />
                           </div>
                        </div>
                        
                        <div className="space-y-4">
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                 <label className="text-[10px] font-bold uppercase text-primary tracking-widest">KM*</label>
                                 <Controller
                                    name="kilometers"
                                    control={control}
                                    rules={{ required: true }}
                                    defaultValue={editingVehicle?.kilometers}
                                    render={({ field }) => (
                                       <NumericFormat
                                          value={field.value}
                                          onValueChange={(values) => field.onChange(values.floatValue)}
                                          className="w-full bg-[#2a2a2a] border-none text-white py-3 px-4 outline-none"
                                          thousandSeparator="."
                                          decimalSeparator=","
                                          suffix=" KM"
                                          placeholder="Ex: 50.000 KM"
                                       />
                                    )}
                                 />
                              </div>
                              <div className="space-y-1">
                                 <label className="text-[10px] font-bold uppercase text-primary tracking-widest">Câmbio</label>
                                 <input {...register('transmission')} defaultValue={editingVehicle?.transmission} className="w-full bg-[#2a2a2a] border-none text-white py-3 px-4 outline-none" />
                              </div>
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                   <label className="text-[10px] font-bold uppercase text-primary tracking-widest">Potência</label>
                                   <input {...register('power')} defaultValue={editingVehicle?.power} className="w-full bg-[#2a2a2a] border-none text-white py-3 px-4 outline-none" placeholder="Ex: 540 CV" />
                                </div>
                                <div className="space-y-1">
                                   <label className="text-[10px] font-bold uppercase text-primary tracking-widest">Tração</label>
                                   <input {...register('traction')} defaultValue={editingVehicle?.traction} className="w-full bg-[#2a2a2a] border-none text-white py-3 px-4 outline-none" placeholder="Ex: 6x4" />
                                </div>
                           </div>
                           <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-primary tracking-widest">Descrição</label>
                              <textarea {...register('description')} defaultValue={editingVehicle?.description} className="w-full bg-[#2a2a2a] border-none text-white py-3 px-4 outline-none h-24 resize-none" />
                           </div>
                           <div className="flex items-center gap-3 py-2">
                              <input type="checkbox" {...register('isFeatured')} defaultChecked={editingVehicle?.isFeatured} id="isFeatured" className="w-5 h-5 accent-primary" />
                              <label htmlFor="isFeatured" className="text-xs uppercase font-bold text-white cursor-pointer tracking-widest">Destacar na Home</label>
                           </div>
                        </div>

                        <div className="md:col-span-2 pt-6">
                           <button type="submit" className="w-full industrial-gradient text-black py-5 font-headline font-black uppercase tracking-[0.2em]">
                               {editingVehicle ? 'Atualizar Veículo' : 'Salvar Veículo'}
                           </button>
                        </div>
                     </form>
                  </div>
               </div>
            )}
        </div>
    );
}

function ContactManager() {
    const [messages, setMessages] = useState<ContactMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState<string | null>(null);

    useEffect(() => {
        fetchMessages();
    }, []);

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, 'contacts'));
            setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContactMessage)).sort((a,b) => b.createdAt - a.createdAt));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Deseja excluir este contato?')) return;
        await deleteDoc(doc(db, 'contacts', id));
        setFeedback('Contato excluído!');
        setTimeout(() => setFeedback(null), 3000);
        fetchMessages();
    };

    const updateStatus = async (id: string, status: string) => {
       await updateDoc(doc(db, 'contacts', id), { status });
       setFeedback('Status atualizado!');
       setTimeout(() => setFeedback(null), 3000);
       fetchMessages();
    };

    return (
        <div className="space-y-12">
            <div>
               <h1 className="text-4xl font-headline font-black text-white uppercase tracking-tighter mb-2">Contatos Recebidos</h1>
               <p className="text-on-surface-variant uppercase tracking-widest text-xs font-bold">Gerencie os leads vindos do formulário de contato.</p>
            </div>

            {feedback && (
                <div className="bg-green-500/20 border border-green-500 text-green-500 p-4 font-bold uppercase text-[10px] tracking-widest flex items-center gap-3">
                    <CheckCircle size={16} /> {feedback}
                </div>
            )}

            <div className="bg-surface border border-white/5 overflow-x-auto">
               <table className="w-full text-left">
                  <thead>
                     <tr className="bg-background border-b border-white/10">
                        <th className="px-6 py-4 font-headline uppercase text-xs tracking-widest text-primary">Data</th>
                        <th className="px-6 py-4 font-headline uppercase text-xs tracking-widest text-primary">Cliente</th>
                        <th className="px-6 py-4 font-headline uppercase text-xs tracking-widest text-primary">Contato</th>
                        <th className="px-6 py-4 font-headline uppercase text-xs tracking-widest text-primary">Status</th>
                        <th className="px-6 py-4 font-headline uppercase text-xs tracking-widest text-primary text-right">Ações</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                     {messages.map(m => (
                        <tr key={m.id} className="hover:bg-white/5 transition-colors group">
                           <td className="px-6 py-6 text-xs text-on-surface-variant whitespace-nowrap">
                              {new Date(m.createdAt).toLocaleDateString('pt-BR')} <br/>
                              {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                           </td>
                           <td className="px-6 py-6 font-headline font-bold uppercase text-sm text-white">
                              {m.name}
                              <p className="text-[10px] font-normal text-on-surface-variant italic normal-case mt-1 max-w-md line-clamp-2">"{m.message}"</p>
                           </td>
                           <td className="px-6 py-6 text-xs text-on-surface-variant space-y-1">
                              <p className="flex items-center gap-2"><Phone size={12} className="text-primary"/> {m.whatsapp}</p>
                              <p className="flex items-center gap-2"><Mail size={12} className="text-primary"/> {m.email}</p>
                           </td>
                           <td className="px-6 py-6">
                              <select 
                                value={m.status} 
                                onChange={(e) => updateStatus(m.id, e.target.value)}
                                className={cn(
                                    "bg-background text-[10px] font-bold uppercase p-1 border outline-none",
                                    m.status === 'new' ? "text-primary border-primary" : "text-on-surface-variant border-white/10"
                                )}
                              >
                                 <option value="new">Novo</option>
                                 <option value="read">Lido</option>
                                 <option value="answered">Respondido</option>
                              </select>
                           </td>
                           <td className="px-6 py-6 text-right space-x-3">
                              <a 
                                href={`https://wa.me/55${m.whatsapp.replace(/\D/g, '')}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-all px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
                              >
                                 <MessageSquare size={14} /> WhatsApp
                              </a>
                              <button onClick={() => handleDelete(m.id)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity transition-all"><Trash2 size={18} /></button>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
               {messages.length === 0 && !loading && (
                   <div className="p-20 text-center text-on-surface-variant uppercase text-xs tracking-widest font-bold">Nenhum contato encontrado.</div>
               )}
            </div>
        </div>
    );
}

function SettingsManager() {
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState<string | null>(null);
    const { register, handleSubmit, setValue, getValues } = useForm();

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, 'settings'));
            if (!snap.empty) {
                const data = snap.docs[0].data();
                setSettings({ id: snap.docs[0].id, ...data });
                setValue('logoUrl', data.logoUrl);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: any) => {
        try {
            if (settings) {
                await updateDoc(doc(db, 'settings', settings.id), data);
            } else {
                await addDoc(collection(db, 'settings'), data);
            }
            setFeedback('Configurações aplicadas!');
            setTimeout(() => setFeedback(null), 3000);
            fetchSettings();
        } catch (err) {
            console.error(err);
            alert('Erro ao salvar configurações.');
        }
    };

    return (
        <div className="space-y-12">
            <div>
               <h1 className="text-4xl font-headline font-black text-white uppercase tracking-tighter mb-2">Configurações Gerais</h1>
               <p className="text-on-surface-variant uppercase tracking-widest text-xs font-bold">Personalize a identidade visual e informações do site.</p>
            </div>

            {feedback && (
                <div className="bg-green-500/20 border border-green-500 text-green-500 p-4 font-bold uppercase text-[10px] tracking-widest flex items-center gap-3 max-w-2xl">
                    <CheckCircle size={16} /> {feedback}
                </div>
            )}

            <div className="bg-surface p-10 border border-white/5 max-w-2xl">
               <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                  <div className="space-y-4">
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-primary tracking-widest">URL do Logotipo</label>
                        <input 
                           {...register('logoUrl')} 
                           className="w-full bg-[#2a2a2a] border-none text-white py-4 px-6 outline-none mb-4" 
                           placeholder="https://sua-logo.com/logo.png"
                        />
                        <MediaUpload 
                          label="Ou suba o logotipo" 
                          folder="settings" 
                          onUpload={(url) => setValue('logoUrl', url)} 
                        />
                        <p className="text-[10px] text-on-surface-variant mt-2 italic">Recomendado: Fundo transparente (PNG), altura mínima de 128px.</p>
                     </div>
                  </div>
                  
                  {settings?.logoUrl && (
                      <div className="p-4 bg-background border border-white/5 inline-block">
                         <p className="text-[10px] font-bold text-primary uppercase mb-4 tracking-widest">Pré-visualização:</p>
                         <img src={settings.logoUrl} alt="Logo Preview" className="h-20 object-contain" />
                      </div>
                  )}

                  <button type="submit" className="industrial-gradient text-black px-12 py-5 font-headline font-black uppercase tracking-widest text-sm hover:scale-105 transition-all shadow-xl shadow-primary/20">
                     Salvar Alterações
                  </button>
               </form>
            </div>
        </div>
    );
}

function BannerManager() {
    const [banners, setBanners] = useState<Banner[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState<Banner | null>(null);
    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState<string | null>(null);

    const { register, handleSubmit, reset, setValue } = useForm();

    useEffect(() => {
        fetchBanners();
    }, []);

    async function fetchBanners() {
        setLoading(true);
        try {
          const snap = await getDocs(collection(db, 'banners'));
          setBanners(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner)).sort((a,b) => a.order - b.order));
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
    }

    const onSubmit = async (data: any) => {
        const docData = { ...data, order: Number(data.order) };
        try {
            if (editing) {
                await updateDoc(doc(db, 'banners', editing.id), docData);
            } else {
                await addDoc(collection(db, 'banners'), docData);
            }
            setFeedback('Banner salvo!');
            setTimeout(() => setFeedback(null), 3000);
            setIsFormOpen(false);
            setEditing(null);
            reset();
            fetchBanners();
        } catch (err) {
            console.error(err);
            alert('Erro ao salvar banner.');
        }
    };

    const handleDelete = async (id: string) => {
      if(!confirm('Excluir?')) return;
      try {
        await deleteDoc(doc(db, 'banners', id));
        setFeedback('Banner removido!');
        setTimeout(() => setFeedback(null), 3000);
        fetchBanners();
      } catch (err) {
        console.error(err);
      }
    }

    return (
        <div className="space-y-12">
            <div className="flex justify-between items-end">
                <div>
                   <h1 className="text-4xl font-headline font-black text-white uppercase tracking-tighter mb-2">Banners Hero</h1>
                   <p className="text-on-surface-variant uppercase tracking-widest text-xs font-bold">Gerencie os slides da home page.</p>
                </div>
                <button onClick={() => {setEditing(null); reset(); setIsFormOpen(true);}} className="industrial-gradient text-black font-headline font-black uppercase text-xs px-8 py-4 flex items-center gap-3 transition-all transform hover:scale-105"><Plus size={18} /> Novo Banner</button>
            </div>

            {feedback && (
                <div className="bg-green-500/20 border border-green-500 text-green-500 p-4 font-bold uppercase text-[10px] tracking-widest flex items-center gap-3">
                    <CheckCircle size={16} /> {feedback}
                </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-primary" size={32} />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {banners.map(b => (
                    <div key={b.id} className="bg-surface border border-white/5 overflow-hidden group hover:border-primary/50 transition-all">
                      <div className="aspect-video relative overflow-hidden">
                          <img src={b.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                            <button onClick={() => {setEditing(b); setIsFormOpen(true);}} className="bg-white text-black p-3 rounded-full hover:bg-primary transition-colors"><Edit2 size={20}/></button>
                            <button onClick={() => handleDelete(b.id)} className="bg-red-500 text-white p-3 rounded-full hover:bg-red-600 transition-colors"><Trash2 size={20}/></button>
                          </div>
                      </div>
                      <div className="p-4 flex justify-between items-center bg-surface">
                          <span className="text-white font-headline font-bold uppercase text-xs truncate max-w-[150px]">{b.title || 'Sem título'}</span>
                          <span className="text-primary font-headline font-black">#{b.order}</span>
                      </div>
                    </div>
                ))}
                {banners.length === 0 && (
                  <div className="col-span-full py-20 text-center text-on-surface-variant uppercase text-xs font-bold tracking-widest">
                    Nenhum banner cadastrado no banco de dados. Use o botão no dashboard para carregar iniciais.
                  </div>
                )}
              </div>
            )}

            {isFormOpen && (
               <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6">
                  <div className="bg-surface w-full max-w-lg p-10 border border-white/10 relative">
                     <button onClick={() => setIsFormOpen(false)} className="absolute top-6 right-6 text-primary"><X /></button>
                     <h2 className="text-xl font-headline font-black text-white uppercase mb-8 border-l-4 border-primary pl-4">Gestão de Banner</h2>
                     <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="space-y-1">
                           <label className="text-[10px] font-bold uppercase text-primary">Título</label>
                           <input {...register('title')} defaultValue={editing?.title} className="w-full bg-[#2a2a2a] text-white py-3 px-4 outline-none" placeholder="Ex: Scania R500" />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[10px] font-bold uppercase text-primary">URL da Imagem</label>
                           <input {...register('imageUrl', { required: true })} defaultValue={editing?.imageUrl} className="w-full bg-[#2a2a2a] text-white py-3 px-4 outline-none mb-2" />
                           <MediaUpload 
                             label="Ou suba a imagem do banner" 
                             folder="banners" 
                             onUpload={(url) => setValue('imageUrl', url)} 
                           />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-primary">Ordem</label>
                              <input type="number" {...register('order')} defaultValue={editing?.order} className="w-full bg-[#2a2a2a] text-white py-3 px-4 outline-none" />
                           </div>
                           <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-primary">Link (Opcional)</label>
                              <input {...register('link')} defaultValue={editing?.link} className="w-full bg-[#2a2a2a] text-white py-3 px-4 outline-none" placeholder="/estoque" />
                           </div>
                        </div>
                        <button type="submit" className="w-full industrial-gradient text-black py-4 font-headline font-black uppercase tracking-widest hover:scale-[1.02] transition-all">Salvar</button>
                     </form>
                  </div>
               </div>
            )}
        </div>
    );
}

function MediaUpload({ onUpload, label, folder = 'uploads' }: { onUpload: (url: string) => void, label: string, folder?: string }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setPreview(url);
      onUpload(url);
    } catch (err) {
      console.error(err);
      alert('Erro ao fazer upload da imagem.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold uppercase text-primary tracking-widest block mb-2">{label}</label>
      <div className="flex gap-4">
        {preview && (
          <div className="w-12 h-12 border border-primary/30 p-1 flex items-center justify-center bg-background shrink-0">
            <img src={preview} alt="Upload preview" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="relative group flex-grow">
          <input 
            type="file" 
            onChange={handleFileChange} 
            accept="image/*"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            disabled={uploading}
          />
          <div className="bg-[#2a2a2a] py-3 px-4 border border-dashed border-white/10 flex items-center justify-center gap-2 text-on-surface-variant group-hover:border-primary transition-all h-full min-h-[48px]">
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Enviando...</span>
              </>
            ) : preview ? (
              <>
                <CheckCircle size={16} className="text-green-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-green-500">Mídia Pronta</span>
              </>
            ) : (
              <>
                <Upload size={16} className="group-hover:text-primary transition-colors" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Escolher Mídia</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BrandManager() {
    const [brands, setBrands] = useState<Brand[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState<string | null>(null);
    const { register, handleSubmit, reset } = useForm();

    useEffect(() => { fetchBrands(); }, []);

    async function fetchBrands() {
        const snap = await getDocs(collection(db, 'brands'));
        setBrands(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand)));
        setLoading(false);
    }

    const onSubmit = async (data: any) => {
        await addDoc(collection(db, 'brands'), data);
        setFeedback('Marca adicionada!');
        setTimeout(() => setFeedback(null), 3000);
        setIsFormOpen(false);
        reset();
        fetchBrands();
    };

    const handleDelete = async (id: string) => {
      if(!confirm('Excluir?')) return;
      await deleteDoc(doc(db, 'brands', id));
      setFeedback('Marca removida!');
      setTimeout(() => setFeedback(null), 3000);
      fetchBrands();
    }

    return (
        <div className="space-y-12">
            <div className="flex justify-between items-end">
                <div>
                   <h1 className="text-4xl font-headline font-black text-white uppercase tracking-tighter mb-2">Filtros de Marcas</h1>
                   <p className="text-on-surface-variant uppercase tracking-widest text-xs font-bold">Defina as marcas disponíveis para filtro.</p>
                </div>
                <button onClick={() => setIsFormOpen(true)} className="industrial-gradient text-black font-headline font-black uppercase text-xs px-8 py-4 flex items-center gap-3 transition-all hover:scale-105"><Plus size={18} /> Nova Marca</button>
            </div>

            {feedback && (
                <div className="bg-green-500/20 border border-green-500 text-green-500 p-4 font-bold uppercase text-[10px] tracking-widest flex items-center gap-3">
                    <CheckCircle size={16} /> {feedback}
                </div>
            )}

            <div className="flex flex-wrap gap-4">
               {brands.map(b => (
                  <div key={b.id} className="bg-surface border border-white/5 px-6 py-4 flex items-center justify-between gap-6 group hover:border-primary/30 transition-all">
                     <span className="text-white font-headline font-bold uppercase tracking-widest">{b.name}</span>
                     <button onClick={() => handleDelete(b.id)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                  </div>
               ))}
               {brands.length === 0 && !loading && (
                 <div className="text-on-surface-variant uppercase text-xs font-bold tracking-widest">Nenhuma marca configurada.</div>
               )}
            </div>

            {isFormOpen && (
               <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6">
                  <div className="bg-surface w-full max-w-sm p-10 border border-white/10 relative">
                     <button onClick={() => setIsFormOpen(false)} className="absolute top-6 right-6 text-primary"><X /></button>
                     <h2 className="text-xl font-headline font-black text-white uppercase mb-8 border-l-4 border-primary pl-4">Nova Marca</h2>
                     <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="space-y-1">
                           <label className="text-[10px] font-bold uppercase text-primary">Nome da Marca</label>
                           <input {...register('name', { required: true })} className="w-full bg-[#2a2a2a] text-white py-3 px-4 outline-none" placeholder="Ex: Scania" />
                        </div>
                        <button type="submit" className="w-full industrial-gradient text-black py-4 font-headline font-black uppercase tracking-widest hover:scale-105 transition-all">Adicionar</button>
                     </form>
                  </div>
               </div>
            )}
        </div>
    );
}

import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Vehicle } from '../types';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Filter, SlidersHorizontal, ArrowRight, Gauge, CalendarDays, X } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // States for filters
  const [selectedBrand, setSelectedBrand] = useState('Todas');
  const [selectedType, setSelectedType] = useState('Todos');

  const [selectedYear, setSelectedYear] = useState('Todos');

  useEffect(() => {
    // Pick up initial filters from URL
    const brandParam = searchParams.get('brand');
    const modelParam = searchParams.get('model');
    const yearParam = searchParams.get('year');

    if (brandParam) setSelectedBrand(brandParam);
    if (modelParam) setSearchTerm(modelParam);
    if (yearParam) setSelectedYear(yearParam);
    
    async function fetchVehicles() {
      try {
        const q = query(collection(db, 'vehicles'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setVehicles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchVehicles();
  }, []);

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = v.model.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          v.brand.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBrand = selectedBrand === 'Todas' || selectedBrand === 'Todas as Marcas' || v.brand === selectedBrand;
    const matchesType = selectedType === 'Todos' || v.type === selectedType;
    const matchesYear = selectedYear === 'Todos' || selectedYear === 'Qualquer Ano' || v.year.toString() === selectedYear;
    return matchesSearch && matchesBrand && matchesType && matchesYear;
  });

  const brands = ['Todas', ...new Set(vehicles.map(v => v.brand).filter(b => b !== 'Todas'))];
  const types = ['Todos', ...new Set(vehicles.map(v => v.type).filter(t => t !== 'Todos'))];
  const yearsList = [...new Set(vehicles.map(v => v.year.toString()).filter(y => y !== 'Todos'))].sort((a, b) => b.localeCompare(a));
  const years = ['Todos', ...yearsList];

  return (
    <div className="pt-24 min-h-screen bg-transparent">
      {/* Header Section */}
      <section className="py-12 bg-surface/30 border-b border-white/5">
        <div className="container mx-auto px-6">
          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-headline font-black text-white uppercase tracking-tighter mb-4">
            Estoque <span className="text-primary italic">Premium</span>
          </h1>
          <p className="text-on-surface-variant uppercase tracking-[0.3em] font-bold text-sm">
            Explorando {filteredVehicles.length} máquinas de alto desempenho
          </p>
        </div>
      </section>

      <div className="container mx-auto px-6 py-12">
        <div className="flex flex-col lg:flex-row gap-12">           {/* Sidebar Filters - Desktop */}
          <aside className="hidden lg:block w-64 space-y-12 h-fit sticky top-32">
             <div>
                <h3 className="font-headline font-bold text-white uppercase tracking-widest text-sm mb-6 border-l-2 border-primary pl-3">Busca</h3>
                <div className="relative">
                   <input 
                      type="text" 
                      placeholder="Ex: Scania R500" 
                      className="w-full bg-surface border-none text-white py-3 pl-4 pr-10 focus:ring-1 focus:ring-primary outline-none"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                   />
                   <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary" />
                </div>
             </div>

             <div>
                <h3 className="font-headline font-bold text-white uppercase tracking-widest text-sm mb-6 border-l-2 border-primary pl-3">Marca</h3>
                <div className="flex flex-col gap-4">
                   {brands.map(brand => (
                      <button 
                        key={brand}
                        onClick={() => setSelectedBrand(brand)}
                        className={cn(
                          "text-left uppercase font-headline font-bold tracking-widest text-xs transition-all",
                          selectedBrand === brand ? "text-primary translate-x-2" : "text-on-surface-variant hover:text-white"
                        )}
                      >
                         {brand}
                      </button>
                   ))}
                </div>
             </div>

             <div>
                <h3 className="font-headline font-bold text-white uppercase tracking-widest text-sm mb-6 border-l-2 border-primary pl-3">Categoria</h3>
                <div className="flex flex-col gap-4">
                   {types.map(type => (
                      <button 
                        key={type}
                        onClick={() => setSelectedType(type)}
                        className={cn(
                          "text-left uppercase font-headline font-bold tracking-widest text-xs transition-all",
                          selectedType === type ? "text-primary translate-x-2" : "text-on-surface-variant hover:text-white"
                        )}
                      >
                         {type}
                      </button>
                   ))}
                </div>
             </div>

             <div>
                <h3 className="font-headline font-bold text-white uppercase tracking-widest text-sm mb-6 border-l-2 border-primary pl-3">Ano</h3>
                <div className="flex flex-col gap-4">
                   {years.map(year => (
                      <button 
                        key={year}
                        onClick={() => setSelectedYear(year)}
                        className={cn(
                          "text-left uppercase font-headline font-bold tracking-widest text-xs transition-all",
                          selectedYear === year ? "text-primary translate-x-2" : "text-on-surface-variant hover:text-white"
                        )}
                      >
                         {year}
                      </button>
                   ))}
                </div>
             </div>
          </aside>


          {/* Mobile Filter Trigger */}
          <div className="lg:hidden flex gap-4">
              <button 
                onClick={() => setIsFilterOpen(true)}
                className="flex-1 industrial-gradient text-black py-4 font-headline font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2"
              >
                 <SlidersHorizontal size={18} /> Filtros
              </button>
          </div>

          {/* Catalog Grid */}
          <div className="flex-grow">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {Array(6).fill(0).map((_, i) => (
                  <div key={i} className="bg-surface aspect-[3/4] animate-pulse" />
                ))}
              </div>
            ) : filteredVehicles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredVehicles.map(vehicle => (
                  <Link key={vehicle.id} to={`/veiculo/${vehicle.id}`} className="group bg-surface flex flex-col border border-white/5 hover:border-primary/30 transition-all">
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <img 
                        src={vehicle.imageUrl} 
                        alt={vehicle.model} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-4 left-4 bg-primary text-black font-headline font-black text-[10px] px-2 py-1 uppercase">{vehicle.brand} ELITE</div>
                    </div>
                    <div className="p-6 flex-grow flex flex-col">
                      <h3 className="font-headline font-bold text-xl text-white uppercase mb-4">{vehicle.brand} {vehicle.model}</h3>
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="flex items-center gap-2 text-on-surface-variant text-xs font-bold uppercase">
                          <CalendarDays size={14} className="text-primary" /> {vehicle.year}
                        </div>
                        <div className="flex items-center gap-2 text-on-surface-variant text-xs font-bold uppercase">
                          <Gauge size={14} className="text-primary" /> {vehicle.kilometers} KM
                        </div>
                      </div>
                      <div className="mt-auto pt-6 border-t border-white/10 flex justify-between items-center">
                        <div>
                          <span className="text-[10px] text-primary font-bold uppercase tracking-widest block mb-1">Valor Premium</span>
                          <span className="text-2xl font-headline font-black text-white">{formatCurrency(vehicle.price)}</span>
                        </div>
                        <span className="w-10 h-10 industrial-gradient flex items-center justify-center text-black group-hover:scale-110 transition-all">
                          <ArrowRight size={20} />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
                <div className="text-center py-20 bg-surface/30">
                   <p className="text-primary font-headline font-black text-2xl uppercase tracking-tighter mb-4">Nenhum resultado encontrado</p>
                   <button 
                    onClick={() => {
                        setSearchTerm(''); 
                        setSelectedBrand('Todas'); 
                        setSelectedType('Todos'); 
                        setSelectedYear('Todos');
                        setSearchParams({});
                    }}
                    className="text-white font-headline font-bold uppercase tracking-widest text-xs border-b border-white hover:text-primary hover:border-primary"
                   >
                     Limpar todos os filtros
                   </button>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isFilterOpen && [
          <motion.div 
             key="overlay"
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             onClick={() => setIsFilterOpen(false)}
             className="fixed inset-0 bg-black/80 z-[60]" 
          />,
          <motion.aside
             key="sidebar"
             initial={{ x: '100%' }}
             animate={{ x: 0 }}
             exit={{ x: '100%' }}
             className="fixed right-0 top-0 h-full w-full max-w-xs bg-surface z-[70] p-10 overflow-y-auto"
          >
               <div className="flex justify-between items-center mb-12">
                  <h2 className="text-2xl font-headline font-black text-white uppercase">Filtros</h2>
                  <button onClick={() => setIsFilterOpen(false)} className="text-primary"><X /></button>
               </div>
               
               <div className="space-y-12">
                  <div>
                      <h3 className="font-headline font-bold text-white uppercase tracking-widest text-xs mb-6 border-l-2 border-primary pl-3">Busca</h3>
                      <input 
                        type="text" 
                        placeholder="Ex: Scania" 
                        className="w-full bg-[#2a2a2a] border-none text-white py-3 px-4 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                  </div>

                  <div>
                      <h3 className="font-headline font-bold text-white uppercase tracking-widest text-xs mb-6 border-l-2 border-primary pl-3">Marca</h3>
                      <div className="flex flex-wrap gap-2">
                        {brands.map(brand => (
                            <button 
                              key={brand}
                              onClick={() => setSelectedBrand(brand)}
                              className={cn(
                                "px-4 py-2 text-xs uppercase font-bold tracking-widest border transition-all",
                                selectedBrand === brand ? "bg-primary text-black border-primary" : "text-white border-white/10 hover:border-primary"
                              )}
                            >
                              {brand}
                            </button>
                        ))}
                      </div>
                  </div>

                  <div>
                      <h3 className="font-headline font-bold text-white uppercase tracking-widest text-xs mb-6 border-l-2 border-primary pl-3">Categoria</h3>
                      <div className="flex flex-wrap gap-2">
                        {types.map(type => (
                            <button 
                              key={type}
                              onClick={() => setSelectedType(type)}
                              className={cn(
                                "px-4 py-2 text-xs uppercase font-bold tracking-widest border transition-all",
                                selectedType === type ? "bg-primary text-black border-primary" : "text-white border-white/10 hover:border-primary"
                              )}
                            >
                              {type}
                            </button>
                        ))}
                      </div>
                  </div>

                  <div>
                      <h3 className="font-headline font-bold text-white uppercase tracking-widest text-xs mb-6 border-l-2 border-primary pl-3">Ano</h3>
                      <div className="flex flex-wrap gap-2">
                        {years.map(year => (
                            <button 
                              key={year}
                              onClick={() => setSelectedYear(year)}
                              className={cn(
                                "px-4 py-2 text-xs uppercase font-bold tracking-widest border transition-all",
                                selectedYear === year ? "bg-primary text-black border-primary" : "text-white border-white/10 hover:border-primary"
                              )}
                            >
                              {year}
                            </button>
                        ))}
                      </div>
                  </div>

                  <button 
                    onClick={() => setIsFilterOpen(false)}
                    className="w-full industrial-gradient text-black py-4 font-headline font-black uppercase tracking-widest"
                  >
                     Aplicar Filtros
                  </button>
               </div>
            </motion.aside>
        ]}
      </AnimatePresence>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Vehicle, Banner } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Filter, ShieldCheck, Headset, ArrowRight, Gauge, Activity, CalendarDays } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';

export default function Home() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Filter States
  const [filterBrand, setFilterBrand] = useState('Todas as Marcas');
  const [filterModel, setFilterModel] = useState('Todos os Modelos');
  const [filterYear, setFilterYear] = useState('Qualquer Ano');

  useEffect(() => {
    async function fetchData() {
      try {
        // Log visit for analytics (Origin tracking)
        const hasLoggedVisit = sessionStorage.getItem('visit_logged');
        if (!hasLoggedVisit) {
          try {
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();
            if (data.city) {
               await addDoc(collection(db, 'visits'), {
                  city: data.city,
                  region: data.region,
                  createdAt: Date.now()
               });
               sessionStorage.setItem('visit_logged', 'true');
            }
          } catch (e) { console.warn("Analytics skipped"); }
        }

        const vehiclesQuery = query(
          collection(db, 'vehicles'),
          orderBy('createdAt', 'desc')
        );
        const vehiclesSnap = await getDocs(vehiclesQuery);
        const vAllData = vehiclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle));
        setAllVehicles(vAllData);
        setVehicles(vAllData.filter(v => v.isFeatured).slice(0, 4));

        const bannersSnap = await getDocs(collection(db, 'banners'));
        const bData = bannersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner)).sort((a, b) => a.order - b.order);
        setBanners(bData);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const brands = ['Todas as Marcas', ...new Set(allVehicles.map(v => v.brand).filter(b => b !== 'Todas as Marcas'))];
  const models = ['Todos os Modelos', ...new Set(allVehicles.filter(v => filterBrand === 'Todas as Marcas' || v.brand === filterBrand).map(v => v.model).filter(m => m !== 'Todos os Modelos'))];
  const yearsList = [...new Set(allVehicles.map(v => v.year.toString()).filter(y => y !== 'Qualquer Ano'))].sort((a, b) => b.localeCompare(a));
  const years = ['Qualquer Ano', ...yearsList];

  const handleFilter = () => {
    const params = new URLSearchParams();
    if (filterBrand !== 'Todas as Marcas') params.set('brand', filterBrand);
    if (filterModel !== 'Todos os Modelos') params.set('model', filterModel);
    if (filterYear !== 'Qualquer Ano') params.set('year', filterYear);
    navigate(`/estoque?${params.toString()}`);
  };

  // Default banners if none exist
  const displayBanners = banners.length > 0 ? banners : [
    {
      id: 'default-1',
      imageUrl: 'https://images.unsplash.com/photo-1586191582151-f73770425983?auto=format&fit=crop&q=80&w=2000',
      title: 'Scania R500 6x4 Highline',
      link: '#',
      order: 0
    },
    {
      id: 'default-2',
      imageUrl: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&q=80&w=2000',
      title: 'Volvo FH 540 6x4 Premium',
      link: '#',
      order: 1
    }
  ];

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % displayBanners.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + displayBanners.length) % displayBanners.length);

  useEffect(() => {
    const timer = setInterval(nextSlide, 5000);
    return () => clearInterval(timer);
  }, [displayBanners.length]);

  return (
    <div className="bg-transparent">
      {/* Hero Section */}
      <section className="relative h-[85vh] w-full overflow-hidden bg-transparent">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0"
          >
            <img 
              src={displayBanners[currentSlide]?.imageUrl} 
              alt={displayBanners[currentSlide]?.title}
              className="w-full h-full object-cover px-0" // Ensure no horizontal padding on images
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
            
            {/* Banner Content */}
            <div className="absolute inset-0 flex items-center">
              <div className="container mx-auto px-6">
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="max-w-2xl"
                >
                  <h1 className="text-4xl sm:text-6xl lg:text-8xl font-headline font-black text-white uppercase tracking-tighter leading-[0.9] mb-6 italic">
                    {displayBanners[currentSlide]?.title.split(' ').map((word, i) => (
                      <span key={i} className={i % 2 !== 0 ? "text-primary" : ""}>{word} </span>
                    ))}
                  </h1>
                  <div className="flex flex-wrap gap-4 mt-8">
                    <Link 
                      to="/estoque" 
                      className="industrial-gradient text-black px-8 sm:px-12 py-4 sm:py-5 font-headline font-black uppercase tracking-widest text-xs sm:text-sm hover:scale-105 transition-all shadow-2xl shadow-primary/20"
                    >
                      Ver Estoque
                    </Link>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Carousel Nav */}
        <div className="absolute bottom-16 left-6 sm:left-auto sm:right-6 flex gap-4 z-40">
          {displayBanners.map((_, i) => (
            <button 
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={cn(
                "h-1.5 transition-all duration-500 rounded-full",
                currentSlide === i ? "w-12 bg-primary" : "w-6 bg-white/30 hover:bg-white/50"
              )}
              aria-label={`Ir para slide ${i + 1}`}
            />
          ))}
        </div>
      </section>

      {/* Quick Search */}
      <section className="relative z-20 -mt-10 sm:-mt-20 container mx-auto px-6">
        <div className="bg-surface p-8 shadow-2xl border-b-4 border-primary">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-2">
              <label className="text-primary text-[10px] font-bold uppercase tracking-widest">Marca</label>
              <select 
                value={filterBrand}
                onChange={(e) => {
                  setFilterBrand(e.target.value);
                  setFilterModel('Todos os Modelos');
                }}
                className="w-full bg-[#2a2a2a] border-none text-white py-3 px-4 outline-none font-headline font-bold uppercase focus:ring-1 focus:ring-primary"
              >
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-primary text-[10px] font-bold uppercase tracking-widest">Modelo</label>
              <select 
                value={filterModel}
                onChange={(e) => setFilterModel(e.target.value)}
                className="w-full bg-[#2a2a2a] border-none text-white py-3 px-4 outline-none font-headline font-bold uppercase focus:ring-1 focus:ring-primary"
              >
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-primary text-[10px] font-bold uppercase tracking-widest">Ano</label>
              <select 
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="w-full bg-[#2a2a2a] border-none text-white py-3 px-4 outline-none font-headline font-bold uppercase focus:ring-1 focus:ring-primary"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button 
                onClick={handleFilter}
                className="w-full industrial-gradient text-black h-[52px] font-headline font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-110 transition-all"
              >
                <Filter size={18} /> Filtrar Agora
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Vehicles */}
      <section className="py-24 container mx-auto px-6">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-3xl sm:text-4xl md:text-6xl font-headline font-black text-white uppercase tracking-tighter">
              Destaques <span className="text-primary">Elite</span>
            </h2>
            <p className="text-on-surface-variant mt-2 max-w-lg text-sm sm:text-base">As máquinas mais potentes do mercado selecionadas para sua frota de alto desempenho.</p>
          </div>
          <div className="flex gap-2">
             <button className="w-12 h-12 border border-white/10 flex items-center justify-center text-white hover:bg-primary hover:text-black transition-all">
                <ChevronLeft size={24} />
             </button>
             <button className="w-12 h-12 border border-white/10 flex items-center justify-center text-white hover:bg-primary hover:text-black transition-all">
                <ChevronRight size={24} />
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {loading ? (
             Array(4).fill(0).map((_, i) => (
                <div key={i} className="bg-surface h-[500px] animate-pulse" />
             ))
          ) : vehicles.map(vehicle => (
            <Link key={vehicle.id} to={`/veiculo/${vehicle.id}`} className="group bg-surface flex flex-col border border-white/5 hover:border-primary/30 transition-all">
              <div className="relative aspect-[16/10] overflow-hidden">
                <img 
                  src={vehicle.imageUrl} 
                  alt={vehicle.model} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-4 left-4 bg-primary text-black font-headline font-black text-[10px] px-2 py-1 uppercase">PREMIUM CHOICE</div>
              </div>
              <div className="p-6 flex-grow flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-headline font-bold text-xl text-white uppercase">{vehicle.brand} {vehicle.model}</h3>
                </div>
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
                    <span className="text-[10px] text-primary font-bold uppercase tracking-widest block mb-1">Sob Consulta</span>
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
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-[#0e0e0e] border-y border-white/5">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-8 bg-surface p-12 flex flex-col justify-between group relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all" />
                <div>
                  <ShieldCheck size={64} className="text-primary mb-8" />
                  <h3 className="text-3xl sm:text-5xl font-headline font-black text-white uppercase tracking-tighter mb-4">Inspeção <span className="text-primary">Ouro</span> Premium</h3>
                  <p className="text-on-surface-variant text-base sm:text-lg max-w-md">Cada veículo passa por um rigoroso checklist. Segurança e procedência são nossas prioridades absolutas.</p>
                </div>
                <Link to="#" className="text-primary font-headline font-bold uppercase tracking-widest flex items-center gap-2 hover:gap-4 transition-all mt-12">
                   Conheça nossa certificação <ArrowRight size={20} />
                </Link>
              </div>
              <div className="md:col-span-4 bg-primary p-12 flex flex-col justify-between">
                 <Headset size={64} className="text-black" />
                 <div>
                    <h3 className="text-2xl sm:text-3xl font-headline font-black text-black uppercase mb-4">Suporte 24/7</h3>
                    <p className="text-black/80 font-bold uppercase text-[10px] sm:text-sm tracking-widest">Equipe dedicada para manter sua frota sempre em movimento.</p>
                 </div>
              </div>
          </div>
        </div>
      </section>

      {/* Map Section */}
      <section className="py-24 relative overflow-hidden bg-background">
          <div className="container mx-auto px-6 relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                  <div>
                    <span className="text-primary font-headline font-black text-[10px] sm:text-sm uppercase tracking-[0.4em] mb-4 block">ONDE ESTAMOS</span>
                    <h2 className="text-3xl sm:text-5xl lg:text-7xl font-headline font-black text-white uppercase tracking-tighter leading-none mb-8">
                       Visite Nossa <span className="text-primary">Sede</span> Premium
                    </h2>
                    <p className="text-on-surface-variant text-base sm:text-lg mb-8 uppercase font-bold tracking-widest leading-relaxed">
                       Anel Rodoviário Jadiel Matos Leste<br/>
                       Chacaras Santa Tereza<br/>
                       Vitória da Conquista - BA, 45000-000
                    </p>
                    <a 
                      href="https://maps.google.com/?q=Premium+Caminhoes+Vitoria+da+Conquista" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="industrial-gradient text-black px-12 py-5 font-headline font-black uppercase tracking-[0.2em] text-lg hover:scale-105 transition-all inline-block shadow-2xl shadow-primary/30"
                    >
                        Abrir no Google Maps
                    </a>
                  </div>
                  <div className="h-[400px] md:h-[600px] bg-surface border border-white/10 shadow-2xl overflow-hidden relative">
                    <iframe 
                      src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3870.435749454131!2d-40.8037305!3d-14.88769!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x746077395bd7b2b%3A0xe5a3f3a88fc8ea65!2sAnel+Rodovi%C3%A1rio+Jadiel+Matos%2C+Vit%C3%B3ria+da+Conquista+-+BA!5e0!3m2!1spt-BR!2sbr!4v1713632400000!5m2!1spt-BR!2sbr" 
                      className="w-full h-full grayscale invert opacity-70 hover:opacity-100 transition-all"
                      style={{ border: 0 }} 
                      allowFullScreen 
                      loading="lazy" 
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
              </div>
          </div>
          <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px]" />
      </section>
    </div>
  );
}

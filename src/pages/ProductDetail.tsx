import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Vehicle } from '../types';
import { CalendarDays, Gauge, Activity, Settings, Fuel, Palette, ShieldCheck, ChevronLeft, ArrowRight, MessageSquare, Phone } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [similar, setSimilar] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!id) return;
      try {
        const docRef = doc(db, 'vehicles', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as Vehicle;
          setVehicle(data);
          setActiveImage(data.imageUrl);

          // Fetch similar
          const q = query(
            collection(db, 'vehicles'),
            where('brand', '==', data.brand),
            limit(4)
          );
          const sSnap = await getDocs(q);
          setSimilar(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)).filter(v => v.id !== id));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    window.scrollTo(0, 0);
  }, [id]);

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-primary font-headline font-black text-2xl animate-pulse tracking-tighter">CARREGANDO DETALHES...</div>;
  if (!vehicle) return <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-8">
     <h1 className="text-4xl font-headline font-black text-white uppercase">Veículo não encontrado</h1>
     <Link to="/estoque" className="industrial-gradient text-black px-8 py-3 font-headline font-black text-xs uppercase tracking-widest">Voltar ao estoque</Link>
  </div>;

  const specs = [
    { label: 'KM', value: `${vehicle.kilometers} KM`, icon: Gauge },
    { label: 'Tração', value: vehicle.traction, icon: Activity },
    { label: 'Potência', value: vehicle.power, icon: Activity },
    { label: 'Ano de Ref.', value: vehicle.year, icon: CalendarDays },
    { label: 'Câmbio', value: vehicle.transmission, icon: Settings },
    { label: 'Tipo', value: vehicle.type, icon: Fuel }
  ];

  return (
    <div className="pt-24 bg-background pb-24 lg:pb-0">
      {/* Visual Section */}
      <section className="px-6 md:px-12 py-8 max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
            <Link to="/estoque" className="flex items-center gap-2 text-primary font-headline font-bold text-xs uppercase group">
              <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Voltar ao Estoque
            </Link>
            
            <div className="space-y-4">
              <div className="relative aspect-video overflow-hidden border border-white/5 bg-surface group">
                 <img 
                   src={activeImage || vehicle.imageUrl} 
                   alt={vehicle.model} 
                   className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                   referrerPolicy="no-referrer"
                 />
                 <div className="absolute top-8 left-8">
                    <span className="bg-primary text-black font-headline font-black text-xs px-4 py-2 uppercase tracking-widest shadow-2xl">Destaque Elite</span>
                 </div>
              </div>

              {vehicle.gallery && vehicle.gallery.length > 0 && (
                <div className="grid grid-cols-4 md:grid-cols-6 gap-4">
                   <button 
                     onClick={() => setActiveImage(vehicle.imageUrl)}
                     className={cn(
                       "aspect-square border-2 transition-all overflow-hidden bg-surface", 
                       activeImage === vehicle.imageUrl ? "border-primary" : "border-transparent opacity-50 hover:opacity-100"
                     )}
                   >
                     <img src={vehicle.imageUrl} className="w-full h-full object-cover shadow-lg" />
                   </button>
                   {vehicle.gallery.map((url, i) => (
                     <button 
                       key={i}
                       onClick={() => setActiveImage(url)}
                       className={cn(
                         "aspect-square border-2 transition-all overflow-hidden bg-surface", 
                         activeImage === url ? "border-primary" : "border-transparent opacity-50 hover:opacity-100"
                       )}
                     >
                       <img src={url} className="w-full h-full object-cover shadow-lg" />
                     </button>
                   ))}
                </div>
              )}
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pt-4">
              <div>
                <h1 className="text-3xl sm:text-5xl lg:text-7xl font-headline font-black text-white uppercase tracking-tighter leading-none mb-2">
                  {vehicle.brand} <span className="text-primary">{vehicle.model}</span>
                </h1>
                <p className="text-on-surface-variant flex items-center gap-4 text-xs font-bold uppercase tracking-[0.2em]">
                   SÉRIE ESPECIAL PREMIUM <span className="w-8 h-[2px] bg-primary"></span> ANO {vehicle.year}
                </p>
              </div>
              <div className="text-right">
                 <span className="text-primary font-headline font-black text-xs uppercase tracking-widest block mb-2">Investimento Premium</span>
                 <span className="text-3xl sm:text-4xl md:text-6xl font-headline font-black text-white">{formatCurrency(vehicle.price)}</span>
              </div>
            </div>
        </div>

        {/* Sidebar Actions */}
        <div className="lg:col-span-4 space-y-6">
            <div className="bg-surface p-8 border border-white/5 shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 -mr-16 -mt-16 rounded-full blur-2xl group-hover:bg-primary/10 transition-all" />
               <h3 className="text-primary font-headline font-bold text-xs uppercase tracking-[0.2em] mb-8 border-l-2 border-primary pl-4">Interessado nesta unidade?</h3>
               <div className="space-y-4">
                  <Link 
                    to={`/contato?veiculo=${encodeURIComponent(`${vehicle.brand} ${vehicle.model}`)}`} 
                    className="w-full industrial-gradient text-black h-16 flex items-center justify-center font-headline font-black uppercase tracking-widest text-sm hover:scale-105 transition-all shadow-xl shadow-primary/20"
                  >
                     Solicitar Proposta
                  </Link>
                  <a 
                    href={`https://wa.me/557799650789?text=Olá! Gostaria de mais informações sobre o ${vehicle.brand} ${vehicle.model}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full border-2 border-primary text-primary h-16 flex items-center justify-center font-headline font-black uppercase tracking-widest text-sm hover:bg-primary/10 transition-all"
                  >
                    <MessageSquare size={18} className="mr-2" /> Falar no WhatsApp
                  </a>
                  <button className="w-full bg-white/5 text-white h-16 flex items-center justify-center font-headline font-black uppercase tracking-widest text-sm hover:bg-white/10 transition-all">
                     <Phone size={18} className="mr-2" /> Agendar Visita
                  </button>
               </div>
               
               <div className="mt-12 flex items-center gap-4 p-4 bg-background/50 border border-white/5">
                  <ShieldCheck size={24} className="text-primary" />
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest leading-relaxed">
                     Esta unidade integra o seleto grupo de veículos aprovados pela Inspeção Ouro Premium.
                  </p>
               </div>
            </div>
        </div>
      </section>

      {/* Details & Specs Section */}
      <section className="py-24 container mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-8">
              <h2 className="text-3xl font-headline font-black text-white uppercase tracking-tighter mb-10 flex items-center gap-4">
                 <span className="w-12 h-[2px] bg-primary"></span> Ficha Técnica Elite
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {specs.map((spec, i) => (
                    <div key={i} className="bg-surface p-6 flex justify-between items-center border border-white/5 hover:border-primary/20 transition-all">
                       <div className="flex items-center gap-4">
                          <spec.icon size={20} className="text-primary" />
                          <span className="text-on-surface-variant uppercase text-[10px] font-bold tracking-widest">{spec.label}</span>
                       </div>
                       <span className="text-white font-headline font-black text-lg uppercase">{spec.value}</span>
                    </div>
                 ))}
              </div>

              <div className="mt-16 bg-surface p-10 border border-white/5">
                 <h3 className="text-2xl font-headline font-bold text-white uppercase mb-6">Sobre o Veículo</h3>
                 <p className="text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                    {vehicle.description}
                 </p>
              </div>
          </div>
          
          <aside className="lg:col-span-4">
             <div className="bg-[#0e0e0e] p-8 border border-white/5 sticky top-32">
                <h3 className="text-primary font-headline font-bold text-xs uppercase tracking-[0.2em] mb-6">Garantias</h3>
                <ul className="space-y-6">
                   <li className="flex gap-4">
                      <div className="w-10 h-10 bg-primary/10 flex items-center justify-center text-primary shrink-0"><ShieldCheck size={20} /></div>
                      <div>
                        <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-1">Câmbio e Motor</h4>
                        <p className="text-on-surface-variant text-[10px] leading-relaxed">Garantia estendida direto com nosso centro de pós-venda.</p>
                      </div>
                   </li>
                   <li className="flex gap-4">
                      <div className="w-10 h-10 bg-primary/10 flex items-center justify-center text-primary shrink-0"><Settings size={20} /></div>
                      <div>
                        <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-1">Histórico Limpo</h4>
                        <p className="text-on-surface-variant text-[10px] leading-relaxed">Procedência totalmente auditada com laudo cautelar incluso.</p>
                      </div>
                   </li>
                </ul>
             </div>
          </aside>
      </section>

      {/* Similar Vehicles */}
      {similar.length > 0 && (
         <section className="py-24 border-t border-white/5">
            <div className="container mx-auto px-6">
               <h2 className="text-3xl font-headline font-black text-white uppercase tracking-tighter mb-12">Você também pode gostar</h2>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {similar.map(v => (
                     <Link key={v.id} to={`/veiculo/${v.id}`} className="group bg-surface border border-white/5 hover:border-primary/30 transition-all">
                        <div className="relative aspect-video overflow-hidden">
                           <img src={v.imageUrl} alt={v.model} className="w-full h-full object-cover group-hover:scale-105 transition-all" referrerPolicy="no-referrer" />
                        </div>
                        <div className="p-6">
                            <h3 className="text-white font-headline font-bold uppercase mb-4">{v.brand} {v.model}</h3>
                            <div className="flex justify-between items-center">
                               <span className="text-primary font-headline font-black text-xl">{formatCurrency(v.price)}</span>
                               <span className="text-on-surface-variant group-hover:text-primary"><ArrowRight size={20} /></span>
                            </div>
                        </div>
                     </Link>
                  ))}
               </div>
            </div>
         </section>
      )}
      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-background/80 backdrop-blur-lg border-t border-white/5 z-40 lg:hidden flex gap-4">
          <Link 
            to={`/contato?veiculo=${encodeURIComponent(`${vehicle.brand} ${vehicle.model}`)}`} 
            className="flex-1 industrial-gradient text-black h-14 flex items-center justify-center font-headline font-black uppercase tracking-widest text-xs"
          >
             Tenho Interesse
          </Link>
          <a 
            href={`https://wa.me/557799650789?text=Olá! Gostaria de mais informações sobre o ${vehicle.brand} ${vehicle.model}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-14 h-14 bg-[#25D366] text-white flex items-center justify-center rounded-sm"
          >
            <MessageSquare size={24} fill="currentColor" />
          </a>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Mail, Phone, MapPin, Send } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useForm, Controller } from 'react-hook-form';
import { PatternFormat } from 'react-number-format';
import { useSearchParams } from 'react-router-dom';

export default function Contact() {
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const vehicleName = searchParams.get('veiculo');
  const { register, handleSubmit, control } = useForm();

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      await addDoc(collection(db, 'contacts'), {
        ...data,
        status: 'new',
        vehicleOfInterest: vehicleName || 'Geral',
        createdAt: Date.now()
      });
      
      const message = vehicleName 
        ? `Olá! Sou ${data.name} e tenho interesse no veículo *${vehicleName}*.`
        : `Olá! Sou ${data.name} e gostaria de mais informações.`;
        
      const whatsappUrl = `https://api.whatsapp.com/send/?phone=557799650789&text=${encodeURIComponent(message)}&type=phone_number&app_absent=0`;
      window.location.href = whatsappUrl;
    } catch (err) {
      console.error(err);
      alert('Erro ao enviar mensagem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-24 min-h-screen bg-background relative overflow-hidden flex flex-col">
      <section className="py-24 container mx-auto px-6 relative z-10 flex-grow">
        <div className="max-w-4xl mb-16">
           <h1 className="text-4xl sm:text-6xl lg:text-8xl font-headline font-black text-white uppercase tracking-tighter leading-none mb-8">
              Fale com a <span className="text-primary italic">Elite</span>
           </h1>
           <p className="text-on-surface-variant font-headline font-bold text-sm md:text-lg uppercase tracking-[0.3em] max-w-2xl border-l-4 border-primary pl-6">
              Suporte especializado para frotistas e transportadores de alta performance.
           </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 mt-20">
           <div className="lg:col-span-7 bg-surface p-10 md:p-16 border border-white/5 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
               <h2 className="text-2xl font-headline font-black text-white uppercase mb-12 border-l-4 border-primary pl-6">Solicitação de Atendimento</h2>
               <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-primary">Nome Completo</label>
                        <input 
                           type="text" 
                           {...register('name', { required: true })}
                           className="w-full bg-[#2a2a2a] border-none text-white py-4 px-6 outline-none focus:ring-1 focus:ring-primary" 
                           placeholder="Ex: João Silva" 
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-primary">WhatsApp/Telefone</label>
                        <Controller
                           name="whatsapp"
                           control={control}
                           rules={{ required: true }}
                           render={({ field }) => (
                              <PatternFormat
                                 format="(##) #####-####"
                                 mask="_"
                                 value={field.value}
                                 onValueChange={(values) => field.onChange(values.value)}
                                 className="w-full bg-[#2a2a2a] border-none text-white py-4 px-6 outline-none focus:ring-1 focus:ring-primary"
                                 placeholder="(77) 99999-9999"
                              />
                           )}
                        />
                     </div>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold uppercase tracking-widest text-primary">E-mail Corporativo (Opcional)</label>
                     <input 
                        type="email" 
                        {...register('email')}
                        className="w-full bg-[#2a2a2a] border-none text-white py-4 px-6 outline-none focus:ring-1 focus:ring-primary" 
                        placeholder="joao@empresa.com" 
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold uppercase tracking-widest text-primary">Mensagem</label>
                     <textarea 
                        {...register('message', { required: true })}
                        className="w-full bg-[#2a2a2a] border-none text-white py-4 px-6 outline-none focus:ring-1 focus:ring-primary h-40 resize-none" 
                        placeholder="Como podemos elevar sua operação?" 
                     />
                  </div>
                  <button 
                     disabled={loading}
                     className="industrial-gradient text-black px-12 py-5 font-headline font-black uppercase tracking-widest text-sm hover:scale-105 transition-all shadow-xl shadow-primary/20 flex items-center gap-4 disabled:opacity-50"
                  >
                     {loading ? 'Enviando...' : 'Enviar Mensagem'} <Send size={18} />
                  </button>
               </form>
           </div>

           <div className="lg:col-span-5 space-y-12">
               <div>
                  <h3 className="text-primary font-headline font-bold text-xs uppercase tracking-[0.2em] mb-8">Canais de Elite</h3>
                  <div className="space-y-10">
                     <div className="flex gap-6">
                        <div className="w-14 h-14 bg-surface flex items-center justify-center text-primary shrink-0"><Phone size={24} /></div>
                        <div>
                           <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">WhatsApp de Vendas</p>
                           <p className="text-2xl font-headline font-black text-white">+55 77 9965-0789</p>
                        </div>
                     </div>
                     <div className="flex gap-6">
                        <div className="w-14 h-14 bg-surface flex items-center justify-center text-primary shrink-0"><Mail size={24} /></div>
                        <div>
                           <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">E-mail Corporativo</p>
                           <p className="text-2xl font-headline font-black text-white hover:text-primary transition-colors cursor-pointer">francisco.luciano@hotmail.com</p>
                        </div>
                     </div>
                     <div className="flex gap-6">
                        <div className="w-14 h-14 bg-surface flex items-center justify-center text-primary shrink-0"><MapPin size={24} /></div>
                        <div>
                           <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Endereço da Loja</p>
                           <p className="text-white font-bold leading-relaxed">
                              Anel Rodoviário Jadiel Matos Leste<br />
                              Chacaras Santa Tereza<br />
                              Vitória da Conquista - BA, 45000-000
                           </p>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="bg-surface p-8 border border-white/5 relative group overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent z-0" />
                  <div className="relative z-10">
                     <h4 className="text-white font-headline font-black uppercase mb-4 tracking-tighter">Referência no Sudoeste</h4>
                     <p className="text-on-surface-variant text-xs leading-relaxed uppercase tracking-widest">Atendimento especializado <br />Caminhões e Implementos Premium</p>
                  </div>
               </div>
           </div>
        </div>
      </section>
    </div>
  );
}

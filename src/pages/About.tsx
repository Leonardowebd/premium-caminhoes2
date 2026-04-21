import { ShieldCheck, Target, Award, Users } from 'lucide-react';

export default function About() {
  return (
    <div className="pt-24 min-h-screen bg-background">
      {/* Hero Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] -mr-64 -mt-64" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl">
            <span className="text-primary font-headline font-black text-sm uppercase tracking-[0.4em] mb-4 block">NOSSA HISTÓRIA</span>
            <h1 className="text-6xl md:text-8xl font-headline font-black text-white uppercase tracking-tighter leading-none mb-12">
              Excelência e <span className="text-primary italic">Tradição</span> em Pesados
            </h1>
            <p className="text-on-surface-variant font-headline font-bold text-lg md:text-xl uppercase tracking-widest leading-relaxed max-w-2xl">
              Referência em Vitória da Conquista e todo o Sudoeste Baiano, a Premium Caminhões redefine os padrões de qualidade em veículos pesados e implementos.
            </p>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-24 bg-surface/30 border-y border-white/5">
        <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-20">
          <div className="space-y-8">
             <h2 className="text-4xl font-headline font-black text-white uppercase tracking-tighter">O Compromisso <span className="text-primary">Premium</span></h2>
             <p className="text-on-surface-variant leading-relaxed text-lg">
                Localizada estrategicamente em Vitória da Conquista, a Premium Caminhões nasceu para atender transportadores que buscam robustez e procedência. Nossa trajetória é marcada pela seleção rigorosa de cada caminhão e implemento em nosso estoque.
             </p>
             <p className="text-on-surface-variant leading-relaxed text-lg">
                Para nós, cada veículo é o motor do progresso de nossos clientes. Por isso, oferecemos um atendimento consultivo e especializado para garantir que sua escolha seja a ferramenta perfeita para o seu sucesso na estrada.
             </p>
          </div>
          <div className="grid grid-cols-2 gap-8">
             {[
               { icon: ShieldCheck, label: 'Segurança', desc: 'Processos auditados' },
               { icon: Target, label: 'Precisão', desc: 'Foco no resultado' },
               { icon: Award, label: 'Elite', desc: 'Apenas o melhor' },
               { icon: Users, label: 'Conexão', desc: 'Parceria real' }
             ].map((item, i) => (
                <div key={i} className="bg-surface p-8 border border-white/5 flex flex-col justify-between hover:border-primary/30 transition-all group">
                   <item.icon size={40} className="text-primary mb-6 group-hover:scale-110 transition-transform" />
                   <div>
                      <h4 className="text-white font-headline font-black uppercase tracking-widest text-sm mb-1">{item.label}</h4>
                      <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest">{item.desc}</p>
                   </div>
                </div>
             ))}
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-32 container mx-auto px-6">
         <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-5xl font-headline font-black text-white uppercase tracking-tighter mb-6">Nossa <span className="text-primary italic">Visão</span> de Futuro</h2>
            <p className="text-on-surface-variant uppercase tracking-widest text-sm font-bold">Inovação e sustentabilidade na logística pesada.</p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { title: 'Qualidade Absoluta', content: 'Não aceitamos nada menos que a perfeição mecânica e estética em nosso catálogo.' },
              { title: 'Ética Operacional', content: 'Transparência total em cada negociação, desde o primeiro contato até o pós-venda.' },
              { title: 'Foco no Cliente', content: 'Entendemos os desafios da sua frota e oferecemos o equipamento exato para vencê-los.' }
            ].map((v, i) => (
               <div key={i} className="bg-surface p-12 border-t-4 border-primary shadow-2xl">
                  <h3 className="text-2xl font-headline font-black text-white uppercase mb-6">{v.title}</h3>
                  <p className="text-on-surface-variant leading-relaxed">{v.content}</p>
               </div>
            ))}
         </div>
      </section>

      {/* CTA section could go here too */}
    </div>
  );
}

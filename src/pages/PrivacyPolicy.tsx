export default function PrivacyPolicy() {
  return (
    <div className="pt-32 pb-24 bg-transparent min-h-screen">
      <div className="container mx-auto px-6 max-w-4xl">
        <h1 className="text-4xl md:text-6xl font-headline font-black text-white uppercase tracking-tighter mb-12 border-l-8 border-primary pl-8">
          Política de <span className="text-primary italic">Privacidade</span>
        </h1>
        
        <div className="space-y-8 text-on-surface-variant font-sans leading-relaxed">
          <section>
            <h2 className="text-xl font-headline font-bold text-white uppercase tracking-widest mb-4">1. Coleta de Informações</h2>
            <p>
              Coletamos informações que você nos fornece diretamente ao preencher formulários de contato em nosso site, como nome, e-mail e número de telefone/WhatsApp. Essas informações são utilizadas exclusivamente para o atendimento de sua solicitação e suporte comercial.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-headline font-bold text-white uppercase tracking-widest mb-4">2. Uso de Dados</h2>
            <p>
              Seus dados são utilizados para:
            </p>
            <ul className="list-disc pl-6 mt-4 space-y-2">
              <li>Responder a pedidos de orçamento ou informações sobre veículos;</li>
              <li>Enviar comunicações sobre novos modelos ou ofertas especiais (caso autorizado);</li>
              <li>Melhorar a experiência de navegação em nosso portal.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-headline font-bold text-white uppercase tracking-widest mb-4">3. Proteção e Segurança</h2>
            <p>
              Implementamos medidas de segurança técnicas e organizacionais para proteger seus dados contra acesso não autorizado, perda ou alteração. Seus dados não são vendidos ou compartilhados com terceiros para fins de marketing sem o seu consentimento explícito.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-headline font-bold text-white uppercase tracking-widest mb-4">4. Cookies</h2>
            <p>
              Utilizamos cookies para entender como você interage com nosso site e para personalizar sua experiência. Você pode gerenciar suas preferências de cookies através das configurações do seu navegador ou de nosso painel de consentimento.
            </p>
          </section>

          <section>
            <p className="text-xs uppercase tracking-[0.2em] font-bold mt-12 border-t border-white/5 pt-8">
              Última atualização: Abril de 2024. Premium Caminhões.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Facebook, Instagram, Twitter, Linkedin, Globe, Share2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function Footer() {
  const [logoUrl, setLogoUrl] = useState<string>('');

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const snap = await getDocs(collection(db, 'settings'));
        if (!snap.empty && snap.docs[0].data().logoUrl) {
          setLogoUrl(snap.docs[0].data().logoUrl);
        }
      } catch (err) {
        console.error("Footer logo fetch error:", err);
      }
    };
    fetchLogo();
  }, []);

  return (
    <footer className="bg-[#0e0e0e] border-t border-white/5 py-16 px-6">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-2">
            <Link to="/" className="inline-block mb-8">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt="Premium Caminhões" 
                  className="h-16 md:h-20 w-auto object-contain filter grayscale hover:grayscale-0 transition-all"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const target = e.target as HTMLImageElement;
                    if (target.parentElement && !target.parentElement.querySelector('.text-logo')) {
                      const span = document.createElement('span');
                      span.className = 'text-logo font-headline font-black text-2xl text-primary uppercase tracking-tighter';
                      span.innerHTML = 'PREMIUM <span class="text-white">CAMINHÕES</span>';
                      target.parentElement.appendChild(span);
                    }
                  }}
                />
              ) : (
                <span className="text-logo font-headline font-black text-2xl text-primary uppercase tracking-tighter">
                  PREMIUM <span className="text-white">CAMINHÕES</span>
                </span>
              )}
            </Link>
            <p className="text-on-surface-variant max-w-sm mb-8">
              Elite em caminhões e implementos. A maior referência do sudoeste baiano em veículos pesados de alto desempenho.
            </p>
            <div className="flex gap-4">
              <a 
                href="https://www.instagram.com/premium.caminhoesvca/" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 border border-white/10 flex items-center justify-center text-on-surface-variant hover:text-primary hover:border-primary transition-all"
              >
                <Instagram size={18} />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-headline font-bold text-white uppercase tracking-widest text-sm mb-6">Institucional</h4>
            <ul className="space-y-4">
              <li><Link to="/privacidade" className="text-on-surface-variant hover:text-primary transition-colors text-sm uppercase tracking-wider">Políticas de Privacidade</Link></li>
              <li><Link to="/termos-de-uso" className="text-on-surface-variant hover:text-primary transition-colors text-sm uppercase tracking-wider">Termos de Uso</Link></li>
              <li><Link to="/sobre-nos" className="text-on-surface-variant hover:text-primary transition-colors text-sm uppercase tracking-wider">Sobre a Premium</Link></li>
              <li><Link to="/estoque" className="text-on-surface-variant hover:text-primary transition-colors text-sm uppercase tracking-wider">Nosso Estoque</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-headline font-bold text-white uppercase tracking-widest text-sm mb-6">Contato</h4>
            <ul className="space-y-4">
              <li><Link to="/contato" className="text-on-surface-variant hover:text-primary transition-colors text-sm uppercase tracking-wider">Canais de Contato</Link></li>
              <li><Link to="/contato" className="text-on-surface-variant hover:text-primary transition-colors text-sm uppercase tracking-wider">Localização</Link></li>
              <li><Link to="/contato" className="text-on-surface-variant hover:text-primary transition-colors text-sm uppercase tracking-wider">WhatsApp Vendas</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-on-surface-variant text-[10px] uppercase tracking-[0.2em] text-center md:text-left">
            © 2024 Premium Caminhões - Elite em Pesados. Todos os direitos reservados.
          </p>
          <div className="flex gap-4">
            <button className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors text-[10px] uppercase tracking-widest">
              <Share2 size={14} /> Compartilhar
            </button>
            <button className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors text-[10px] uppercase tracking-widest">
              <Globe size={14} /> Português (BR)
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

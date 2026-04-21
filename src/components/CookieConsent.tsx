import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, X } from 'lucide-react';

export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('cookie_consent', 'true');
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-6 right-6 md:left-auto md:max-w-md z-[100]"
        >
          <div className="bg-surface border border-white/10 p-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <ShieldCheck size={24} />
              </div>
              <div className="flex-grow">
                <h4 className="text-white font-headline font-bold text-sm uppercase tracking-widest mb-2">Controle de Cookies</h4>
                <p className="text-on-surface-variant text-xs leading-relaxed mb-4">
                  Utilizamos ferramentas de dados para aprimorar sua experiência na <span className="text-primary">Premium Caminhões</span>. Ao continuar, você concorda com nossos termos.
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={acceptCookies}
                    className="flex-grow bg-primary text-black py-2 px-6 font-headline font-black text-[10px] uppercase tracking-widest hover:brightness-110 transition-all"
                  >
                    Aceitar Tudo
                  </button>
                  <button 
                    onClick={() => setShow(false)}
                    className="text-on-surface-variant hover:text-white transition-colors py-2 px-2"
                    title="Fechar"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

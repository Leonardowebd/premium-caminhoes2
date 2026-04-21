import { Link, useLocation } from 'react-router-dom';
import { Search, Menu, X, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    
    setUser(localStorage.getItem('admin_auth') === 'true');

    // Fetch site logo
    const fetchLogo = async () => {
      try {
        const snap = await getDocs(collection(db, 'settings'));
        if (!snap.empty) {
          const data = snap.docs[0].data();
          if (data.logoUrl) setLogoUrl(data.logoUrl);
        }
      } catch (err) {
        console.error("Error fetching logo:", err);
      }
    };
    fetchLogo();
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_auth');
    window.location.href = '/';
  };

  const isAdminPage = location.pathname.startsWith('/admin');

  const navLinks = [
    { label: 'Estoque', href: '/estoque' },
    { label: 'Sobre Nós', href: '/sobre-nos' },
    { label: 'Contato', href: '/contato' },
  ];

  return (
    <header 
      className={cn(
        "fixed top-0 w-full z-50 transition-all duration-300",
        isMenuOpen ? "bg-[#1a1a1c] py-3" : isScrolled ? "glass-effect shadow-2xl py-3" : "bg-transparent py-5"
      )}
    >
      <nav className="container mx-auto px-6 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 group transition-transform hover:scale-105">
           {logoUrl ? (
             <img 
               src={logoUrl} 
               alt="Premium Caminhões" 
               className="h-12 md:h-16 w-auto object-contain"
               referrerPolicy="no-referrer"
               onError={(e) => {
                 (e.target as HTMLImageElement).style.display = 'none';
                 const target = e.target as HTMLImageElement;
                 if (target.parentElement && !target.parentElement.querySelector('.text-logo')) {
                   const span = document.createElement('span');
                   span.className = 'text-logo font-headline font-black text-xl md:text-2xl text-primary uppercase tracking-tighter';
                   span.innerHTML = 'PREMIUM <span class="text-white">CAMINHÕES</span>';
                   target.parentElement.appendChild(span);
                 }
               }}
             />
           ) : (
             <span className="text-logo font-headline font-black text-xl md:text-2xl text-primary uppercase tracking-tighter">
                PREMIUM <span className="text-white">CAMINHÕES</span>
             </span>
           )}
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className="font-headline font-bold uppercase tracking-tighter text-sm text-gray-300 hover:text-primary transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button 
            className="md:hidden text-primary"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-[#1a1a1c] z-[60] md:hidden"
          >
            <div className="flex flex-col h-full">
              <div className="p-6 flex justify-end">
                <button onClick={() => setIsMenuOpen(false)} className="text-primary p-2">
                  <X size={32} />
                </button>
              </div>
              <div className="flex flex-col items-center justify-center flex-grow space-y-8 p-6">
                {navLinks.map((link, i) => (
                  <motion.div
                    key={link.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 + 0.2 }}
                  >
                    <Link
                      to={link.href}
                      onClick={() => setIsMenuOpen(false)}
                      className="font-headline font-black text-4xl uppercase tracking-tighter text-white hover:text-primary transition-colors block text-center"
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                ))}
                
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 }}
                  className="pt-12"
                >
                  <Link 
                    to="/contato" 
                    onClick={() => setIsMenuOpen(false)}
                    className="industrial-gradient text-black px-12 py-4 font-headline font-black uppercase tracking-widest text-sm"
                  >
                    Falar com Consultor
                  </Link>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

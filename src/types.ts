export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  kilometers: number;
  transmission: string;
  power: string;
  traction: string;
  imageUrl: string;
  gallery?: string[];
  description: string;
  isFeatured: boolean;
  type: string;
  createdAt: number;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  message: string;
  subject?: string;
  createdAt: number;
  status: 'new' | 'read' | 'answered';
}

export interface Banner {
  id: string;
  imageUrl: string;
  title: string;
  link: string;
  order: number;
}

export interface Brand {
  id: string;
  name: string;
  logoUrl?: string;
}

export interface SiteSettings {
  logoUrl: string;
  contactPhone: string;
  contactEmail: string;
}

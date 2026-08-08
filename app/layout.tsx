import './globals.css';

export const metadata = {
  title: 'Método Calma - Reto 21 Días',
  description: 'Sistema de captura y email marketing',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

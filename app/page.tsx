import FormularioCaptura from '@/components/FormularioCaptura';

export default function Home() {
  return (
    <main style={{ maxWidth: 480, margin: '4rem auto', padding: '0 1rem' }}>
      <h1 style={{ textAlign: 'center' }}>Método Calma</h1>
      <p style={{ textAlign: 'center', color: '#555' }}>Reto 21 Días Sin Pantallas</p>
      <FormularioCaptura />
    </main>
  );
}

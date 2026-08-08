// components/FormularioCaptura.tsx
'use client';

import React, { useState } from 'react';

interface FormState {
  nombre: string;
  email: string;
  enviando: boolean;
  enviado: boolean;
  error: string | null;
}

export default function FormularioCaptura() {
  const [form, setForm] = useState<FormState>({
    nombre: '',
    email: '',
    enviando: false,
    enviado: false,
    error: null,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value,
      error: null, // Limpiar error cuando escribe
    }));
  };

  const validarEmail = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validar
    if (!form.nombre.trim()) {
      setForm(prev => ({ ...prev, error: '¿Cuál es tu nombre?' }));
      return;
    }

    if (!validarEmail(form.email)) {
      setForm(prev => ({ ...prev, error: 'Email inválido. Intenta de nuevo.' }));
      return;
    }

    setForm(prev => ({ ...prev, enviando: true, error: null }));

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/send-email`
        : '/api/send-email';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          email: form.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error desconocido');
      }

      // Éxito (conserva nombre/email para el mensaje de confirmación)
      setForm(prev => ({ ...prev, enviando: false, enviado: true, error: null }));

      // Mostrar mensaje de éxito por 5 segundos, luego limpiar el formulario
      setTimeout(() => {
        setForm({ nombre: '', email: '', enviando: false, enviado: false, error: null });
      }, 5000);

    } catch (error) {
      setForm(prev => ({
        ...prev,
        enviando: false,
        error: error instanceof Error ? error.message : 'Error al enviar',
      }));
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-center mb-2">
        🎁 Recibe tu guía exclusiva
      </h2>
      <p className="text-center text-gray-600 mb-6 text-sm">
        Primeros pasos del Método Calma + acceso 30 días a PLR Kids Builder
      </p>

      {form.enviado ? (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          <h3 className="font-bold">¡Listo {form.nombre}! 🎉</h3>
          <p className="text-sm mt-1">
            Revisa tu email ({form.email}). La guía está en camino.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Campo Nombre */}
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
              Tu nombre
            </label>
            <input
              type="text"
              id="nombre"
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              placeholder="Ej: María"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              disabled={form.enviando}
            />
          </div>

          {/* Campo Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Tu email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="tu@email.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              disabled={form.enviando}
            />
          </div>

          {/* Mensaje de error */}
          {form.error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
              {form.error}
            </div>
          )}

          {/* Botón */}
          <button
            type="submit"
            disabled={form.enviando}
            className={`w-full py-3 rounded-lg font-bold text-white transition ${
              form.enviando
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
            }`}
          >
            {form.enviando ? 'Enviando...' : 'Enviarme la guía gratis'}
          </button>

          <p className="text-xs text-gray-500 text-center">
            ✓ No compartiremos tu email. Solo guía + info de Método Calma.
          </p>
        </form>
      )}
    </div>
  );
}

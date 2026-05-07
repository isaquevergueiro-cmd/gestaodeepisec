import { createContext, useContext, useState, ReactNode } from 'react';
import type { ColaboradorData } from '../../types';

interface ColaboradorContextType {
  colaborador: ColaboradorData | null;
  setColaborador: (data: ColaboradorData | null) => void;
}

const ColaboradorContext = createContext<ColaboradorContextType | undefined>(undefined);

export function ColaboradorProvider({ children }: { children: ReactNode }) {
  const [colaborador, setColaborador] = useState<ColaboradorData | null>(null);
  return (
    <ColaboradorContext.Provider value={{ colaborador, setColaborador }}>
      {children}
    </ColaboradorContext.Provider>
  );
}

export function useColaborador() {
  const context = useContext(ColaboradorContext);
  if (!context) throw new Error('useColaborador must be used within ColaboradorProvider');
  return context;
}

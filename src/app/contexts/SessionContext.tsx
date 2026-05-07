import { createContext, useContext, useReducer, ReactNode } from 'react';

interface SessionState {
  tecnico_nome: string | null;
  tecnico_id: string | null;
  ativo: boolean;
}

type SessionAction =
  | { type: 'LOGIN'; payload: { nome: string; id: string } }
  | { type: 'LOGOUT' };

const initialState: SessionState = {
  tecnico_nome: null,
  tecnico_id: null,
  ativo: false,
};

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'LOGIN':
      return { tecnico_nome: action.payload.nome, tecnico_id: action.payload.id, ativo: true };
    case 'LOGOUT':
      return initialState;
    default:
      return state;
  }
}

const SessionContext = createContext<{
  state: SessionState;
  dispatch: React.Dispatch<SessionAction>;
} | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, initialState);
  return (
    <SessionContext.Provider value={{ state, dispatch }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used within SessionProvider');
  return context;
}

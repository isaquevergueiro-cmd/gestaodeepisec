import { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  Upload,
  X,
  Check,
  ArrowLeft,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { entregarEpi, extractErrorMessage } from '../../api';
import { useToast } from '../contexts/ToastContext';
import { getTecnicoFromStorage } from '../../utils';
import { StatusBadge } from '../components/StatusBadge';
import type { EpiSubitem } from '../../types';

// Limite de 4 MB para a foto
const MAX_BYTES = 4 * 1024 * 1024;

export function EntregaPage() {
  const { state } = useLocation() as { state?: { epi: EpiSubitem } };
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();
  const { toastSuccess, toastError } = useToast();
  const tecnico      = getTecnicoFromStorage();

  const [foto, setFoto]         = useState<{ base64: string; name: string } | null>(null);
  const [fileErr, setFileErr]   = useState('');
  const fileInputRef             = useRef<HTMLInputElement>(null);

  // Guard: sem EPI no state, volta para busca
  const epi: EpiSubitem | undefined = state?.epi;
  if (!epi) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '50vh',
          gap: 12,
          color: '#4B5563',
        }}
      >
        <AlertCircle size={32} color="#374151" />
        <p style={{ fontSize: 14 }}>Nenhum EPI selecionado.</p>
        <BackBtn onClick={() => navigate('/busca')} label="Voltar ao Balcão" />
      </div>
    );
  }

  // ─── Mutation ─────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: () =>
      entregarEpi(epi.id, foto!.base64, tecnico?.nome ?? 'Técnico'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaborador'] });
      toastSuccess(`${epi.nome} marcado como entregue com sucesso!`);
      navigate('/busca', { replace: true });
    },
    onError: (err) => {
      toastError(`Falha ao confirmar entrega: ${extractErrorMessage(err)}`);
    },
  });

  // ─── File handling ────────────────────────────────────────
  function handleFile(file: File) {
    setFileErr('');
    if (!file.type.startsWith('image/')) {
      setFileErr('Apenas imagens são aceitas (JPEG, PNG, WebP).');
      return;
    }
    if (file.size > MAX_BYTES) {
      setFileErr('A imagem não pode ultrapassar 4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setFoto({ base64: reader.result as string, name: file.name });
    reader.readAsDataURL(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  const canSubmit = !!foto && !mutation.isPending;

  return (
    <div className="page-slide-up" style={{ maxWidth: 640, margin: '0 auto' }}>

      {/* Back */}
      <BackBtn onClick={() => navigate(-1)} label="Voltar" />

      {/* Card do EPI */}
      <div
        style={{
          background: 'rgba(36,40,45,0.90)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          overflow: 'hidden',
          marginBottom: 16,
        }}
      >
        {/* Header colorido */}
        <div
          style={{
            padding: '18px 22px',
            background: 'linear-gradient(135deg, rgba(0,229,255,0.07), rgba(0,229,255,0.02))',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(0,229,255,0.12)',
                border: '1px solid rgba(0,229,255,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={18} color="#00E5FF" />
            </div>
            <div>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: '#4B5563',
                  marginBottom: 3,
                }}
              >
                EPI a Entregar
              </p>
              <h2
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: '#F3F4F6',
                  letterSpacing: '-0.2px',
                  margin: 0,
                }}
              >
                {epi.nome}
              </h2>
            </div>
          </div>
          <StatusBadge status={epi.status} />
        </div>

        {/* Info chips */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <Chip label="Tamanho" value={epi.tamanho || 'Único'} />
          {epi.ca && <Chip label="CA" value={epi.ca} sep />}
        </div>

        {/* Instruções */}
        <div style={{ padding: '16px 22px' }}>
          <p
            style={{
              fontSize: 12,
              color: '#6B7280',
              lineHeight: 1.6,
            }}
          >
            Anexe a <strong style={{ color: '#9CA3AF' }}>foto do recibo assinado</strong> ou a
            captura do colaborador recebendo o item. Isso é obrigatório para fins de auditoria.
          </p>
        </div>
      </div>

      {/* Upload area */}
      <div
        style={{
          background: 'rgba(36,40,45,0.90)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: '22px',
          marginBottom: 16,
        }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            color: '#4B5563',
            marginBottom: 14,
          }}
        >
          Evidência / Comprovante{' '}
          <span style={{ color: '#EF4444' }}>*</span>
        </p>

        {foto ? (
          /* Preview */
          <div
            style={{
              position: 'relative',
              borderRadius: 10,
              overflow: 'hidden',
              border: '1px solid rgba(0,230,118,0.30)',
            }}
          >
            <img
              src={foto.base64}
              alt="Evidência"
              style={{
                width: '100%',
                maxHeight: 300,
                objectFit: 'cover',
                display: 'block',
              }}
            />
            {/* Overlay remove */}
            <div
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
              }}
            >
              <button
                onClick={() => setFoto(null)}
                title="Remover foto"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  borderRadius: 7,
                  background: 'rgba(239,68,68,0.85)',
                  border: '1px solid rgba(239,68,68,0.50)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <X size={13} /> Remover
              </button>
            </div>
            {/* Nome do arquivo */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '6px 12px',
                background: 'rgba(0,0,0,0.60)',
                fontSize: 11,
                color: '#9CA3AF',
                backdropFilter: 'blur(4px)',
              }}
            >
              {foto.name}
            </div>
          </div>
        ) : (
          /* Drop zone */
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            style={{
              border: `2px dashed ${fileErr ? 'rgba(239,68,68,0.50)' : 'rgba(255,255,255,0.10)'}`,
              borderRadius: 12,
              padding: '40px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: 'rgba(255,255,255,0.02)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,229,255,0.35)';
              (e.currentTarget as HTMLElement).style.background = 'rgba(0,229,255,0.03)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = fileErr
                ? 'rgba(239,68,68,0.50)'
                : 'rgba(255,255,255,0.10)';
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: 'rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Camera size={24} color="#6B7280" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#9CA3AF', marginBottom: 4 }}>
                Tirar foto ou selecionar arquivo
              </p>
              <p style={{ fontSize: 12, color: '#4B5563' }}>
                Arraste a imagem aqui ou clique para abrir
              </p>
              <p style={{ fontSize: 11, color: '#374151', marginTop: 6 }}>
                JPEG · PNG · WebP · máx. 4 MB
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <PillBtn icon={<Upload size={12} />} label="Enviar arquivo" />
              <PillBtn icon={<Camera size={12} />} label="Câmera" />
            </div>
          </div>
        )}

        {fileErr && (
          <p
            style={{
              marginTop: 8,
              fontSize: 12,
              color: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <AlertCircle size={12} /> {fileErr}
          </p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* Botões finais */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          disabled={mutation.isPending}
          style={{
            flex: 1,
            padding: '13px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.09)',
            color: '#9CA3AF',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)')}
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={!canSubmit}
          style={{
            flex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '13px',
            borderRadius: 10,
            background: canSubmit
              ? 'linear-gradient(135deg, rgba(0,229,255,0.22), rgba(0,229,255,0.10))'
              : 'rgba(255,255,255,0.04)',
            border: canSubmit
              ? '1px solid rgba(0,229,255,0.40)'
              : '1px solid rgba(255,255,255,0.07)',
            color: canSubmit ? '#00E5FF' : '#374151',
            fontSize: 14,
            fontWeight: 600,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            transition: 'box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            if (canSubmit)
              (e.currentTarget as HTMLElement).style.boxShadow =
                '0 0 24px rgba(0,229,255,0.28)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          }}
        >
          {mutation.isPending ? (
            <Loader2 size={16} className="spin" />
          ) : (
            <>
              <Check size={16} />
              Confirmar Entrega
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Sub-componentes locais ───────────────────────────────────

function BackBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 500,
        color: '#4B5563',
        marginBottom: 16,
        padding: '4px 0',
        cursor: 'pointer',
        transition: 'color 0.15s',
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#9CA3AF')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#4B5563')}
    >
      <ArrowLeft size={14} />
      {label}
    </button>
  );
}

function Chip({ label, value, sep }: { label: string; value: string; sep?: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        padding: '10px 22px',
        borderLeft: sep ? '1px solid rgba(255,255,255,0.05)' : undefined,
      }}
    >
      <p style={{ fontSize: 10, color: '#374151', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 3 }}>
        {label}
      </p>
      <p style={{ fontSize: 14, color: '#E5E7EB', fontWeight: 600, fontFamily: 'monospace' }}>
        {value}
      </p>
    </div>
  );
}

function PillBtn({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 10px',
        borderRadius: 20,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.09)',
        fontSize: 11,
        color: '#6B7280',
      }}
    >
      {icon}
      {label}
    </span>
  );
}

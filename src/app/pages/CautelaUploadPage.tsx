import { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import {
  Upload,
  Check,
  X,
  Loader2,
  AlertCircle,
  Paperclip,
  ArrowLeft,
  FileText,
  User,
} from 'lucide-react';
import { uploadCautela, extractErrorMessage } from '../../api';
import { useToast } from '../contexts/ToastContext';
import type { ColaboradorCautelaInfo } from '../../api';

interface LocationState {
  subitem_id?: string;
  colaborador?: ColaboradorCautelaInfo;
  modo?: 'anexar' | 'n8n';
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function CautelaUploadPage() {
  const { state }  = useLocation() as { state?: LocationState };
  const navigate   = useNavigate();
  const { toastSuccess, toastError } = useToast();

  const [file, setFile]       = useState<{ base64: string; nome: string; tipo: string } | null>(null);
  const [fileErr, setFileErr] = useState('');
  const fileInputRef           = useRef<HTMLInputElement>(null);

  const subitemId   = state?.subitem_id;
  const colaborador = state?.colaborador;

  // Guard: sem subitem_id, volta ao check
  if (!subitemId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: 12, color: '#4B5563' }}>
        <AlertCircle size={32} color="#374151" />
        <p style={{ fontSize: 14 }}>Nenhum subitem selecionado para o upload.</p>
        <button
          onClick={() => navigate('/cautela')}
          style={{ fontSize: 13, color: '#A855F7', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}
        >
          Voltar à verificação
        </button>
      </div>
    );
  }

  // ─── Mutation ─────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: () => uploadCautela(file!.base64, file!.nome, subitemId),
    onSuccess: () => {
      toastSuccess('Cautela anexada com sucesso! O N8N irá processar o documento em instantes.');
      navigate('/busca', { replace: true });
    },
    onError: (err) => toastError(`Falha no upload: ${extractErrorMessage(err)}`),
  });

  // ─── File handlers ────────────────────────────────────────
  function handleFile(f: File) {
    setFileErr('');
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(f.type)) {
      setFileErr('Apenas PDF, JPEG, PNG ou WebP são aceitos.');
      return;
    }
    if (f.size > MAX_BYTES) {
      setFileErr('O arquivo não pode ultrapassar 10 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () =>
      setFile({ base64: reader.result as string, nome: f.name, tipo: f.type });
    reader.readAsDataURL(f);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  const isPdf   = file?.tipo === 'application/pdf';
  const canSend = !!file && !mutation.isPending;

  return (
    <div className="page-slide-up" style={{ maxWidth: 640, margin: '0 auto' }}>

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: '#4B5563', marginBottom: 20, cursor: 'pointer', transition: 'color 0.15s' }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#9CA3AF')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#4B5563')}
      >
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* Info do contexto */}
      <div
        style={{
          background: 'rgba(36,40,45,0.90)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          overflow: 'hidden',
          marginBottom: 14,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(168,85,247,0.07), rgba(168,85,247,0.01))',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Paperclip size={17} color="#A855F7" />
          </div>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#4B5563', marginBottom: 3 }}>
              Anexar Cautela
            </p>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#F3F4F6', margin: 0, letterSpacing: '-0.2px' }}>
              Upload para o Monday.com
            </h2>
          </div>
        </div>

        {/* Chips de contexto */}
        <div style={{ padding: '12px 20px', display: 'flex', gap: 16, borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap' }}>
          {colaborador && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <User size={12} color="#6B7280" />
              <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}>{colaborador.nome}</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <FileText size={12} color="#6B7280" />
            <span style={{ fontSize: 12, color: '#6B7280' }}>Subitem: </span>
            <code style={{ fontSize: 11, color: '#A855F7', background: 'rgba(168,85,247,0.08)', padding: '1px 6px', borderRadius: 4 }}>{subitemId}</code>
          </div>
        </div>

        {/* Aviso N8N */}
        <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#A855F7', boxShadow: '0 0 5px #A855F7', flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
            O N8N irá monitorar este subitem. Após o upload, ele validará o documento e atualizará os dados do colaborador automaticamente.
          </p>
        </div>
      </div>

      {/* Upload area */}
      <div
        style={{
          background: 'rgba(36,40,45,0.90)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: '22px',
          marginBottom: 14,
        }}
      >
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#4B5563', marginBottom: 14 }}>
          Arquivo da Cautela <span style={{ color: '#EF4444' }}>*</span>
        </p>

        {file ? (
          /* Preview */
          <div
            style={{
              display: 'flex',
              flexDirection: isPdf ? 'column' : undefined,
              alignItems: isPdf ? undefined : 'center',
              justifyContent: isPdf ? undefined : 'space-between',
              borderRadius: 10,
              overflow: 'hidden',
              border: '1px solid rgba(0,230,118,0.30)',
              background: 'rgba(0,230,118,0.05)',
            }}
          >
            {isPdf ? (
              /* PDF preview */
              <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 9, background: 'rgba(0,230,118,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={20} color="#00E676" />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#A7F3D0', margin: 0 }}>{file.nome}</p>
                    <p style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }}>PDF · pronto para enviar</p>
                  </div>
                </div>
                <button
                  onClick={() => setFile(null)}
                  style={{ color: '#4B5563', cursor: 'pointer', padding: 6, borderRadius: 7, transition: 'color 0.15s' }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#EF4444')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#4B5563')}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              /* Imagem preview */
              <div style={{ position: 'relative', width: '100%' }}>
                <img src={file.base64} alt="Cautela" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }} />
                <button
                  onClick={() => setFile(null)}
                  style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,0.85)', border: '1px solid rgba(239,68,68,0.50)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(4px)' }}
                >
                  <X size={13} /> Remover
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Drop zone */
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            style={{
              border: `2px dashed ${fileErr ? 'rgba(239,68,68,0.50)' : 'rgba(168,85,247,0.25)'}`,
              borderRadius: 12,
              padding: '44px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              background: 'rgba(168,85,247,0.03)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(168,85,247,0.50)';
              (e.currentTarget as HTMLElement).style.background = 'rgba(168,85,247,0.06)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = fileErr ? 'rgba(239,68,68,0.50)' : 'rgba(168,85,247,0.25)';
              (e.currentTarget as HTMLElement).style.background = 'rgba(168,85,247,0.03)';
            }}
          >
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(168,85,247,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={24} color="#A855F7" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#C084FC', marginBottom: 5 }}>
                Selecionar cautela ou arrastar aqui
              </p>
              <p style={{ fontSize: 12, color: '#4B5563' }}>PDF · JPEG · PNG · WebP · máx. 10 MB</p>
            </div>
          </div>
        )}

        {fileErr && (
          <p style={{ marginTop: 8, fontSize: 12, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 5 }}>
            <AlertCircle size={12} /> {fileErr}
          </p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* Botões */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          disabled={mutation.isPending}
          style={{ flex: 1, padding: '13px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#9CA3AF', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'background 0.15s' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)')}
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!canSend}
          onClick={() => mutation.mutate()}
          style={{
            flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '13px', borderRadius: 10,
            background: canSend
              ? 'linear-gradient(135deg, rgba(168,85,247,0.22), rgba(168,85,247,0.10))'
              : 'rgba(255,255,255,0.04)',
            border: canSend ? '1px solid rgba(168,85,247,0.40)' : '1px solid rgba(255,255,255,0.07)',
            color: canSend ? '#C084FC' : '#374151',
            fontSize: 14, fontWeight: 600,
            cursor: canSend ? 'pointer' : 'not-allowed',
            transition: 'box-shadow 0.2s',
          }}
          onMouseEnter={(e) => { if (canSend) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 22px rgba(168,85,247,0.28)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
        >
          {mutation.isPending
            ? <Loader2 size={16} className="spin" />
            : <><Check size={15} /> Enviar Cautela ao Monday</>
          }
        </button>
      </div>
    </div>
  );
}

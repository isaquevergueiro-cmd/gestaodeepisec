import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import {
  FilePlus,
  Upload,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  User,
  Package,
  FileText,
  Paperclip,
  CheckCircle2,
  ChevronRight,
  X,
} from 'lucide-react';
import { cadastrarAdmissao, uploadCautela, extractErrorMessage } from '../../api';
import { useToast } from '../contexts/ToastContext';
import { formatCpf, validarCpf } from '../../utils';
import {
  CARGOS,
  getContratos,
  getKitGroup,
  type EpiCatalogItem,
} from '../../catalog';
import type { AdmissaoEpiItem } from '../../types';
import type { ColaboradorCautelaInfo } from '../../api';

// ─── Tipos ───────────────────────────────────────────────────
type Modo = 'anexar' | 'manual';

interface LocationState {
  cpf?: string;
  colaborador?: ColaboradorCautelaInfo;
}

interface EpiRow {
  _id: number;
  item: EpiCatalogItem;
  tamanho: string;
  incluir: boolean;
}

const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XGG', '34', '36', '37', '38', '39', '40', '41', '42', '43', '44', 'U'];

let rowId = 0;

// ─── COMPONENTE ───────────────────────────────────────────────
export function CautelaPage() {
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: LocationState };
  const { toastSuccess, toastError } = useToast();

  const [modo, setModo] = useState<Modo>('manual');

  // ── Estado: Modo Anexar ────────────────────────────────────
  const [pdfFile, setPdfFile] = useState<{ base64: string; nome: string } | null>(null);
  const [pdfErr, setPdfErr]   = useState('');
  const pdfInputRef           = useRef<HTMLInputElement>(null);

  // ── Estado: Modo Manual ────────────────────────────────────
  // Pre-preenche CPF se vier da pré-tela
  const [nome,     setNome]     = useState('');
  const [cpf,      setCpf]      = useState(state?.cpf ? formatCpf(state.cpf) : '');
  const [cargo,    setCargo]    = useState('');
  const [contrato, setContrato] = useState('');
  const [rows,     setRows]     = useState<EpiRow[]>([]);
  const [errors,   setErrors]   = useState<Record<string, string>>({});
  const [touched,  setTouched]  = useState(false);

  // ─── Mutations ────────────────────────────────────────────
  const uploadMutation = useMutation({
    mutationFn: () => uploadCautela(pdfFile!.base64, pdfFile!.nome, ''), // sem subitem_id no modo manual+anexar
    onSuccess: () => {
      toastSuccess('Cautela enviada! O N8N irá processar e criar os itens no Monday em instantes.');
      navigate('/busca');
    },
    onError: (err) => toastError(`Falha no upload: ${extractErrorMessage(err)}`),
  });

  const manualMutation = useMutation({
    mutationFn: () => {
      const episSelecionados = rows
        .filter((r) => r.incluir && r.tamanho)
        .map<AdmissaoEpiItem>((r) => ({ nome: r.item.nome, tamanho: r.tamanho }));

      return cadastrarAdmissao({
        nome: nome.trim(),
        cpf: cpf.replace(/\D/g, ''),
        contrato,
        epis: episSelecionados,
      });
    },
    onSuccess: (result) => {
      toastSuccess(`Colaborador criado! Agora anexe a cautela.`);
      // Navega para o upload com o subitem de CAUTELA que foi criado junto
      navigate('/cautela/upload', {
        state: {
          subitem_id: result.cautelaSubitemId,
          modo: 'anexar',
        },
      });
    },
    onError: (err) => toastError(`Falha ao gerar cautela: ${extractErrorMessage(err)}`),
  });

  // ─── Handlers: PDF ────────────────────────────────────────
  function handlePdfFile(file: File) {
    setPdfErr('');
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      setPdfErr('Apenas PDF ou imagem (JPEG/PNG) são aceitos.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPdfErr('O arquivo não pode ultrapassar 10 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () =>
      setPdfFile({ base64: reader.result as string, nome: file.name });
    reader.readAsDataURL(file);
  }

  // ─── Handlers: Cargo/Contrato ─────────────────────────────
  function handleCargo(val: string) {
    setCargo(val);
    setContrato('');
    setRows([]);
  }

  function handleContrato(val: string) {
    const realVal = val === '(Qualquer)' ? '*' : val;
    setContrato(val);
    const grupo = getKitGroup(cargo, realVal);
    if (grupo) {
      setRows(
        grupo.itens.map((item) => ({
          _id: ++rowId,
          item,
          tamanho: '',
          incluir: true,
        })),
      );
    }
  }

  // ─── Handlers: Rows ───────────────────────────────────────
  const toggleRow = (id: number) =>
    setRows((prev) => prev.map((r) => (r._id === id ? { ...r, incluir: !r.incluir } : r)));

  const setTamanho = (id: number, tam: string) =>
    setRows((prev) => prev.map((r) => (r._id === id ? { ...r, tamanho: tam } : r)));

  const removeRow = (id: number) => setRows((prev) => prev.filter((r) => r._id !== id));

  const addCustomRow = () => {
    // Abre um prompt simples para EPI customizado (fora do kit)
    const nomeEpi = window.prompt('Nome do EPI (ex: BOTA DE SEGURANÇA):');
    if (nomeEpi?.trim()) {
      setRows((prev) => [
        ...prev,
        {
          _id: ++rowId,
          item: { id: 'custom', nome: nomeEpi.trim().toUpperCase(), preco: 0, ca: null, cor: '' },
          tamanho: '',
          incluir: true,
        },
      ]);
    }
  };

  // ─── Validação Manual ─────────────────────────────────────
  function validateManual(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!nome.trim())           errs.nome     = 'Nome obrigatório.';
    if (!validarCpf(cpf.replace(/\D/g, ''))) errs.cpf = 'CPF inválido.';
    if (!cargo)                 errs.cargo    = 'Selecione o cargo.';
    if (!contrato)              errs.contrato = 'Selecione o contrato.';
    const selecionados = rows.filter((r) => r.incluir);
    if (selecionados.length === 0) errs.epis = 'Selecione ao menos 1 EPI.';
    selecionados.forEach((r) => {
      if (!r.tamanho) errs[`tam_${r._id}`] = 'Tamanho obrigatório.';
    });
    return errs;
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const errs = validateManual();
    setErrors(errs);
    if (Object.keys(errs).length === 0) manualMutation.mutate();
  }

  const contratos = getContratos(cargo);

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <div className="page-slide-up" style={{ maxWidth: 800, margin: '0 auto' }}>

      {/* ── Tabs de modo ── */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12,
          padding: 4,
          marginBottom: 24,
        }}
      >
        {([
          { value: 'manual',  icon: <FilePlus size={15} />,  label: 'Criar Manualmente',  sub: 'Monte o kit pelo cargo/contrato' },
          { value: 'anexar',  icon: <Paperclip size={15} />, label: 'Anexar Cautela',      sub: 'PDF / Imagem → N8N processa' },
        ] as { value: Modo; icon: React.ReactNode; label: string; sub: string }[]).map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setModo(tab.value)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 18px',
              borderRadius: 9,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s',
              background: modo === tab.value
                ? 'rgba(168,85,247,0.12)'
                : 'transparent',
              outline: modo === tab.value
                ? '1px solid rgba(168,85,247,0.30)'
                : 'none',
            }}
          >
            <span style={{ color: modo === tab.value ? '#A855F7' : '#4B5563' }}>{tab.icon}</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: modo === tab.value ? '#C084FC' : '#6B7280' }}>
                {tab.label}
              </div>
              <div style={{ fontSize: 11, color: '#4B5563', marginTop: 1 }}>{tab.sub}</div>
            </div>
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          MODO: ANEXAR CAUTELA
      ══════════════════════════════════════════════════════ */}
      {modo === 'anexar' && (
        <div>
          <div
            style={{
              background: 'rgba(36,40,45,0.90)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: '24px',
              marginBottom: 16,
            }}
          >
            <SectionTitle icon={<Paperclip size={14} />} title="Upload da Cautela de Admissão" />
            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7, marginBottom: 20 }}>
              Selecione o documento de cautela (PDF ou foto). Após o envio, o{' '}
              <strong style={{ color: '#9CA3AF' }}>N8N</strong> irá validar, extrair os dados e
              criar o colaborador + EPIs no Monday automaticamente.
            </p>

            {/* Info do destino */}
            <div
              style={{
                display: 'flex',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 9,
                background: 'rgba(168,85,247,0.07)',
                border: '1px solid rgba(168,85,247,0.20)',
                marginBottom: 20,
              }}
            >
              <AlertCircle size={14} color="#A855F7" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: '#C084FC', lineHeight: 1.5 }}>
                O arquivo será anexado na coluna <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: 4 }}>file_mkvvbkwx</code> do board de gestão e o N8N iniciará o processamento.
              </p>
            </div>

            {pdfFile ? (
              /* Preview do arquivo */
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: 10,
                  background: 'rgba(0,230,118,0.07)',
                  border: '1px solid rgba(0,230,118,0.25)',
                  marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircle2 size={20} color="#00E676" />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#A7F3D0' }}>{pdfFile.nome}</p>
                    <p style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Pronto para enviar</p>
                  </div>
                </div>
                <button
                  onClick={() => setPdfFile(null)}
                  style={{ color: '#4B5563', cursor: 'pointer', padding: 4, borderRadius: 6, transition: 'color 0.15s' }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#EF4444')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#4B5563')}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              /* Drop zone */
              <div
                onClick={() => pdfInputRef.current?.click()}
                style={{
                  border: `2px dashed ${pdfErr ? 'rgba(239,68,68,0.50)' : 'rgba(168,85,247,0.25)'}`,
                  borderRadius: 12,
                  padding: '48px 24px',
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
                  (e.currentTarget as HTMLElement).style.borderColor = pdfErr ? 'rgba(239,68,68,0.50)' : 'rgba(168,85,247,0.25)';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(168,85,247,0.03)';
                }}
              >
                <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(168,85,247,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Upload size={24} color="#A855F7" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#C084FC', marginBottom: 4 }}>
                    Selecionar cautela ou arrastar aqui
                  </p>
                  <p style={{ fontSize: 12, color: '#4B5563' }}>PDF · JPEG · PNG · máx. 10 MB</p>
                </div>
              </div>
            )}

            {pdfErr && (
              <p style={{ marginTop: 8, fontSize: 12, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 5 }}>
                <AlertCircle size={12} /> {pdfErr}
              </p>
            )}

            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if(f) handlePdfFile(f); e.target.value = ''; }}
              style={{ display: 'none' }}
            />
          </div>

          {/* Botão enviar */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{ flex: 1, padding: '13px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#9CA3AF', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!pdfFile || uploadMutation.isPending}
              onClick={() => uploadMutation.mutate()}
              style={{
                flex: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '13px', borderRadius: 10,
                background: pdfFile ? 'linear-gradient(135deg, rgba(168,85,247,0.22), rgba(168,85,247,0.10))' : 'rgba(255,255,255,0.04)',
                border: pdfFile ? '1px solid rgba(168,85,247,0.40)' : '1px solid rgba(255,255,255,0.07)',
                color: pdfFile ? '#C084FC' : '#374151',
                fontSize: 14, fontWeight: 600,
                cursor: pdfFile ? 'pointer' : 'not-allowed',
                transition: 'box-shadow 0.2s',
              }}
              onMouseEnter={(e) => { if(pdfFile) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 22px rgba(168,85,247,0.28)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
            >
              {uploadMutation.isPending
                ? <Loader2 size={16} className="spin" />
                : <><Upload size={15} /> Enviar para N8N</>
              }
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODO: CRIAR MANUALMENTE
      ══════════════════════════════════════════════════════ */}
      {modo === 'manual' && (
        <form onSubmit={handleManualSubmit} noValidate>

          {/* Seção: Colaborador */}
          <Card>
            <SectionTitle icon={<User size={14} />} title="Dados do Colaborador" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Nome Completo" error={touched ? errors.nome : undefined}>
                <StyledInput
                  placeholder="Ex: João da Silva"
                  value={nome}
                  onChange={(v) => setNome(v)}
                />
              </Field>
              <Field label="CPF" error={touched ? errors.cpf : undefined}>
                <StyledInput
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  maxLength={14}
                  value={cpf}
                  onChange={(v) => setCpf(formatCpf(v))}
                />
              </Field>
            </div>
          </Card>

          {/* Seção: Cargo / Contrato → Kit automático */}
          <Card>
            <SectionTitle icon={<FileText size={14} />} title="Cargo e Contrato" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Cargo / Função" error={touched ? errors.cargo : undefined}>
                <StyledSelect
                  value={cargo}
                  onChange={handleCargo}
                  options={[{ value: '', label: 'Selecione o cargo...' }, ...CARGOS.map((c) => ({ value: c, label: c }))]}
                />
              </Field>
              <Field label="Contrato / Órgão" error={touched ? errors.contrato : undefined}>
                <StyledSelect
                  value={contrato}
                  onChange={handleContrato}
                  disabled={!cargo}
                  options={[
                    { value: '', label: cargo ? 'Selecione o contrato...' : '— selecione o cargo primeiro —' },
                    ...contratos.map((c) => ({ value: c, label: c })),
                  ]}
                />
              </Field>
            </div>

            {cargo && contrato && rows.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  padding: '9px 14px',
                  borderRadius: 8,
                  background: 'rgba(0,230,118,0.06)',
                  border: '1px solid rgba(0,230,118,0.18)',
                  fontSize: 12,
                  color: '#6EE7B7',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                <CheckCircle2 size={13} color="#00E676" />
                Kit padrão carregado com {rows.length} itens. Revise os tamanhos abaixo.
              </div>
            )}
          </Card>

          {/* Seção: Enxoval de EPIs */}
          {rows.length > 0 && (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <SectionTitle icon={<Package size={14} />} title="Enxoval de EPIs" inline />
                <button
                  type="button"
                  onClick={addCustomRow}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#A855F7', padding: '4px 10px', borderRadius: 6, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.22)', cursor: 'pointer' }}
                >
                  <Plus size={12} /> Adicionar item
                </button>
              </div>

              {touched && errors.epis && (
                <p style={{ marginBottom: 12, fontSize: 12, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <AlertCircle size={12} /> {errors.epis}
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rows.map((row) => (
                  <div
                    key={row._id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '28px 1fr 140px 32px',
                      gap: 10,
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: 9,
                      background: row.incluir ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)',
                      border: `1px solid ${row.incluir ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)'}`,
                      opacity: row.incluir ? 1 : 0.5,
                      transition: 'all 0.15s',
                    }}
                  >
                    {/* Checkbox incluir */}
                    <input
                      type="checkbox"
                      checked={row.incluir}
                      onChange={() => toggleRow(row._id)}
                      style={{ width: 16, height: 16, accentColor: '#A855F7', cursor: 'pointer' }}
                    />

                    {/* Nome + CA */}
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#E5E7EB', margin: 0 }}>{row.item.nome}</p>
                      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                        {row.item.ca && (
                          <span style={{ fontSize: 10, color: '#6B7280', background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: 4 }}>
                            {row.item.ca}
                          </span>
                        )}
                        {row.item.cor && (
                          <span style={{ fontSize: 10, color: '#6B7280' }}>· {row.item.cor}</span>
                        )}
                      </div>
                    </div>

                    {/* Tamanho */}
                    <div>
                      <select
                        value={row.tamanho}
                        disabled={!row.incluir}
                        onChange={(e) => setTamanho(row._id, e.target.value)}
                        style={{
                          width: '100%',
                          background: 'rgba(255,255,255,0.05)',
                          border: `1px solid ${touched && errors[`tam_${row._id}`] && row.incluir ? 'rgba(239,68,68,0.50)' : 'rgba(255,255,255,0.10)'}`,
                          borderRadius: 7,
                          padding: '7px 9px',
                          fontSize: 13,
                          color: row.tamanho ? '#E5E7EB' : '#4B5563',
                          fontFamily: 'inherit',
                          cursor: row.incluir ? 'pointer' : 'not-allowed',
                          outline: 'none',
                        }}
                      >
                        <option value="">Tam.</option>
                        {TAMANHOS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {touched && errors[`tam_${row._id}`] && row.incluir && (
                        <p style={{ fontSize: 10, color: '#EF4444', marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <AlertCircle size={9} /> {errors[`tam_${row._id}`]}
                        </p>
                      )}
                    </div>

                    {/* Remover */}
                    <button
                      type="button"
                      onClick={() => removeRow(row._id)}
                      style={{ color: '#4B5563', cursor: 'pointer', padding: 4, borderRadius: 6, transition: 'color 0.15s' }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#EF4444')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#4B5563')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 12, padding: '9px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', fontSize: 12, color: '#4B5563', display: 'flex', alignItems: 'center', gap: 7 }}>
                <FileText size={13} />
                {rows.filter((r) => r.incluir).length} de {rows.length} itens selecionados
              </div>
            </Card>
          )}

          {/* Botões */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{ flex: 1, padding: '13px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#9CA3AF', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={manualMutation.isPending}
              style={{
                flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '13px', borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(168,85,247,0.22), rgba(168,85,247,0.10))',
                border: '1px solid rgba(168,85,247,0.40)',
                color: '#C084FC', fontSize: 14, fontWeight: 600,
                cursor: manualMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: manualMutation.isPending ? 0.7 : 1,
                transition: 'box-shadow 0.2s',
              }}
              onMouseEnter={(e) => { if (!manualMutation.isPending) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 22px rgba(168,85,247,0.30)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
            >
              {manualMutation.isPending
                ? <Loader2 size={16} className="spin" />
                : <><FilePlus size={15} /> Gerar Cautela <ChevronRight size={14} /></>
              }
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Sub-componentes locais ───────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(36,40,45,0.90)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 24px', marginBottom: 16 }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, inline }: { icon: React.ReactNode; title: string; inline?: boolean }) {
  const el = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: '#9CA3AF' }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#6B7280' }}>{title}</span>
    </div>
  );
  return inline ? el : <div style={{ marginBottom: 18 }}>{el}</div>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#4B5563', marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {error && <p style={{ marginTop: 5, fontSize: 11, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={10} />{error}</p>}
    </div>
  );
}

function StyledInput({ placeholder, value, onChange, inputMode, maxLength }: { placeholder?: string; value: string; onChange: (v: string) => void; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; maxLength?: number }) {
  return (
    <input
      type="text" placeholder={placeholder} value={value} inputMode={inputMode} maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, padding: '10px 13px', fontSize: 13, color: '#E5E7EB', fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.15s' }}
      onFocus={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(168,85,247,0.45)')}
      onBlur={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.09)')}
    />
  );
}

function StyledSelect({ value, onChange, options, disabled }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean }) {
  return (
    <select
      value={value} disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: value ? '#E5E7EB' : '#4B5563', fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer', outline: 'none', transition: 'border-color 0.15s', appearance: 'none', opacity: disabled ? 0.5 : 1 }}
      onFocus={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(168,85,247,0.45)'; }}
      onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.09)'; }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

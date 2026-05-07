import { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SignatureCanvas from 'react-signature-canvas';
import { jsPDF } from 'jspdf';
import { X, Loader2, Check, Package2, PenLine, AlertCircle, Trash2, ChevronRight, Minus, Plus, Tag, ShieldCheck } from 'lucide-react';
import { uploadCautela, extractErrorMessage, listarCatalogoEpis, type ColaboradorAdmissional, type CatalogoItem } from '../../api';
import { useToast } from '../contexts/ToastContext';

interface SelectedEpi { item: CatalogoItem; tamanho: string; quantidade: number; }

const TAMANHOS = ['PP','P','M','G','GG','XGG','34','36','37','38','39','40','41','42','43','44','U'];

// Cores vivas para os grupos de contrato
const GRUPO_COLORS: Record<string, [string, string]> = {
  'SEMSA':    ['#00E676','#059669'],
  'SEDUC':    ['#00E5FF','#0284C7'],
  'CETAM':    ['#00E5FF','#0284C7'],
  'DETRAN':   ['#A855F7','#7C3AED'],
  'ENCARRE':  ['#F59E0B','#D97706'],
};
function grupoAccent(nome: string): string {
  const k = Object.keys(GRUPO_COLORS).find(k => nome.toUpperCase().includes(k));
  return k ? GRUPO_COLORS[k][0] : '#6B7280';
}

function corCss(cor: string): string {
  const map: Record<string,string> = {
    'verde musgo':'#4a7c59','verde':'#16a34a','branco':'#cbd5e1','preto':'#374151',
    'azul marinho':'#1d4ed8','azul':'#3b82f6','amarelo':'#ca8a04','cinza':'#6b7280',
    'vermelho':'#dc2626','laranja':'#ea580c',
  };
  return map[cor?.toLowerCase()?.trim()] ?? '#6b7280';
}

const HEADER_H = 64;

const overlay: React.CSSProperties = {
  position:'fixed', inset:0, background:'rgba(0,0,0,0.85)',
  zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center',
  padding:'24px',
};
const panel: React.CSSProperties = {
  background:'#0d1117', border:'1px solid rgba(255,255,255,0.09)', borderRadius:18,
  width:'100%', maxWidth:1020, height:'calc(100vh - 48px)', maxHeight: 850,
  display:'flex', flexDirection:'column', overflow:'hidden',
  boxShadow:'0 24px 64px rgba(0,0,0,0.6)',
};
const inp: React.CSSProperties = {
  background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.09)',
  borderRadius:7, padding:'6px 10px', fontSize:12, color:'#E5E7EB',
  fontFamily:'inherit', outline:'none', width:'100%',
};

function gerarPDF(colab: ColaboradorAdmissional, epis: SelectedEpi[], tecnico: string, sigColab: string, sigTec: string): string {
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const W=210; const M=14; let y=14;
  const verde:[number,number,number]=[0,112,60];
  const cinza:[number,number,number]=[80,80,80];
  doc.setFillColor(0,0,0); doc.rect(M,y,W-M*2,8,'F');
  doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text('CONTATO',M+2,y+5.5);
  doc.text('CAUTELA DE RECEBIMENTO DE EPI/UNIFORMES',M+32,y+5.5);
  doc.setFontSize(6); doc.text('Codigo: RM.SESMT-00\nEmissao: 07/10/2024\nRev.02',W-M-2,y+2,{align:'right'});
  y+=10;
  doc.setTextColor(0,0,0); doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.text('EMPRESA:',M,y+4); doc.setFont('helvetica','bold');
  doc.text('CONTATO SERVICOS DE CONSERVACAO E MANUTENCAO LTDA',M+22,y+4);
  y+=7; doc.setFont('helvetica','normal'); doc.text('CNPJ: 04.768.594/0001-36',M,y+3); y+=7;
  doc.setFillColor(...verde); doc.rect(M,y,W-M*2,6,'F');
  doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text('DADOS DO FUNCIONARIO',M+2,y+4.5); y+=7;
  doc.setTextColor(0,0,0); doc.setFont('helvetica','normal'); doc.setFontSize(9);
  doc.text('NOME: '+colab.nome,M,y+4); y+=6;
  doc.text('CPF: '+colab.cpf,M,y+4); doc.text('RG: '+(colab.rg||'—'),M+70,y+4); y+=6;
  doc.text('FUNCAO: '+(colab.funcao||'—'),M,y+4); doc.text('ORGAO: '+(colab.orgao||'—'),M+80,y+4); y+=10;
  doc.setFont('helvetica','bold'); doc.setFontSize(9);
  doc.text('TERMO DE RESPONSABILIDADE',W/2,y,{align:'center'}); y+=6;
  const termo='Declaro haver recebido gratuitamente os EPIs/uniformes abaixo descritos, comprometendo-me a utiliza-los de forma adequada conforme NR-6. Comprometo-me a zelar pela conservacao, devolver ao termino do contrato em ate 48h, e autorizo descontos por danos por dolo nos termos do art. 462 da CLT.';
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
  const tLines=doc.splitTextToSize(termo,W-M*2);
  doc.text(tLines,M,y); y+=tLines.length*4+8;
  doc.text('MANAUS - AM, '+new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'}),M,y); y+=10;
  doc.setFillColor(...verde); doc.rect(M,y,W-M*2,6,'F');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(8);
  doc.text('RELACAO DE ITENS ENTREGUES',M+2,y+4.5); y+=8;
  doc.setTextColor(0,0,0); doc.setFont('helvetica','normal'); doc.setFontSize(8);
  epis.forEach((e,i)=>{
    const parts=[(i+1)+'. '+e.item.nome];
    if (e.tamanho) parts.push('Tam: '+e.tamanho);
    if (e.quantidade>1) parts.push('Qtd: '+e.quantidade);
    if (e.item.ca) parts.push('CA: '+e.item.ca);
    if (e.item.preco>0) parts.push('R$ '+(e.item.preco*e.quantidade).toFixed(2));
    doc.text(parts.join('  |  '),M,y); y+=5;
  });
  y+=12;
  const hw=(W-M*2)/2;
  if (sigColab){try{doc.addImage(sigColab,'PNG',M,y-18,64,18);}catch(_){}}
  doc.setDrawColor(0); doc.line(M,y,M+hw-8,y); y+=4;
  doc.setFontSize(8); doc.text('Assinatura do Funcionario',M,y); y+=4;
  doc.setFontSize(7); doc.setTextColor(...cinza); doc.text(colab.nome,M,y);
  const tx=M+hw+8; const ty=y-8;
  doc.setTextColor(0,0,0);
  if (sigTec){try{doc.addImage(sigTec,'PNG',tx,ty-18,64,18);}catch(_){}}
  doc.line(tx,ty,W-M,ty);
  doc.setFontSize(8); doc.text('Responsavel pela Entrega (SESMT)',tx,ty+4);
  doc.setFontSize(7); doc.setTextColor(...cinza); doc.text(tecnico,tx,ty+8);
  return doc.output('datauristring');
}

export function CriarCautelaModal({ colab, onClose }: { colab: ColaboradorAdmissional; onClose: ()=>void }) {
  const { toastSuccess, toastError } = useToast();
  const qc = useQueryClient();
  const sigColabRef = useRef<SignatureCanvas>(null);
  const sigTecRef   = useRef<SignatureCanvas>(null);
  const [step, setStep]             = useState<'epis'|'assinar'>('epis');
  const [selected, setSelected]     = useState<Map<string,SelectedEpi>>(new Map());
  const [grupoAtivo, setGrupoAtivo] = useState<string|null>(null);
  const [sigColabErr, setSigColabErr] = useState('');
  const [sigTecErr, setSigTecErr]     = useState('');

  const tecnico = (()=>{ try { return JSON.parse(localStorage.getItem('epi_tecnico')||'{}').nome||'Tecnico SESMT'; } catch { return 'Tecnico SESMT'; } })();
  const { data:cat, isLoading:loadingCat } = useQuery({ queryKey:['catalogo-epis'], queryFn:listarCatalogoEpis, staleTime:5*60*1000 });
  const grupos = cat?.grupos ?? [];
  const detectedGrupo = useMemo(()=>{
    if (!grupos.length) return null;
    const org=(colab.orgao||'').toUpperCase(); const fun=(colab.funcao||'').toUpperCase();
    return grupos.find(g=>{ const t=g.nome.toUpperCase(); return (org&&t.includes(org))||(fun&&t.includes(fun)); })?.nome ?? grupos[0]?.nome ?? null;
  },[grupos,colab]);
  const grupo      = grupoAtivo ?? detectedGrupo;
  const grupoItems = grupos.find(g=>g.nome===grupo)?.items ?? [];
  const selArr     = Array.from(selected.values());
  const total      = selArr.reduce((s,e)=>s+e.item.preco*e.quantidade,0);

  // Auto-selecionar os itens do grupo detectado na primeira carga
  const [autoSelecionou, setAutoSelecionou] = useState(false);
  useEffect(() => {
    if (!loadingCat && grupoItems.length > 0 && !autoSelecionou && grupo === detectedGrupo) {
      const newSel = new Map();
      grupoItems.forEach(item => {
        newSel.set(item.id, { item, tamanho: '', quantidade: 1 });
      });
      setSelected(newSel);
      setAutoSelecionou(true);
    }
  }, [loadingCat, grupoItems, autoSelecionou, grupo, detectedGrupo]);

  function handleGroupSelect(nome: string) {
    setGrupoAtivo(nome);
    const gItems = grupos.find(g => g.nome === nome)?.items ?? [];
    const newSel = new Map();
    gItems.forEach(item => {
      newSel.set(item.id, { item, tamanho: '', quantidade: 1 });
    });
    setSelected(newSel);
  }

  function toggle(item: CatalogoItem) {
    setSelected(p=>{ const n=new Map(p); n.has(item.id)?n.delete(item.id):n.set(item.id,{item,tamanho:'',quantidade:1}); return n; });
  }
  function setTam(id:string,t:string) { setSelected(p=>{ const n=new Map(p); const e=n.get(id); if(e) n.set(id,{...e,tamanho:t}); return n; }); }
  function setQtd(id:string,q:number) { setSelected(p=>{ const n=new Map(p); const e=n.get(id); if(e) n.set(id,{...e,quantidade:Math.max(1,Math.min(20,q))}); return n; }); }
  function rem(id:string) { setSelected(p=>{ const n=new Map(p); n.delete(id); return n; }); }

  const mut = useMutation({
    mutationFn: async ()=>{
      setSigColabErr(''); setSigTecErr('');
      let err=false;
      if (sigColabRef.current?.isEmpty()){setSigColabErr('Assinatura do colaborador obrigatoria.');err=true;}
      if (sigTecRef.current?.isEmpty()){setSigTecErr('Assinatura do tecnico obrigatoria.');err=true;}
      if (err) throw new Error('sig');
      const sColab=sigColabRef.current!.toDataURL('image/png');
      const sTec=sigTecRef.current!.toDataURL('image/png');
      const uri=gerarPDF(colab,selArr,tecnico,sColab,sTec);
      const nome=`Cautela_${colab.nome.replace(/ /g,'_')}_${Date.now()}.pdf`;
      await uploadCautela('data:application/pdf;base64,'+uri.split(',')[1],nome,colab.id);
    },
    onSuccess:()=>{ toastSuccess('Cautela gerada e enviada!'); qc.invalidateQueries({queryKey:['as0-colaboradores']}); onClose(); },
    onError:(e)=>{ if((e as Error).message!=='sig') toastError(extractErrorMessage(e)); },
  });

  const accent = grupoAccent(grupo || '');

  const content = (
    <div style={overlay}>
      <div style={panel}>

        {/* Header */}
        <div style={{ padding:'12px 18px', borderBottom:'1px solid rgba(255,255,255,0.07)',
          display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0,
          background:'rgba(255,255,255,0.015)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:10, flexShrink:0,
              background:'rgba(168,85,247,0.15)', border:'1px solid rgba(168,85,247,0.30)',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              {step==='epis' ? <Package2 size={18} color="#A855F7"/> : <PenLine size={18} color="#A855F7"/>}
            </div>
            <div>
              <p style={{ fontSize:14, fontWeight:700, color:'#F3F4F6', margin:0 }}>Criar Cautela</p>
              <p style={{ fontSize:11, color:'#6B7280', margin:'2px 0 0' }}>
                {colab.nome}
                {colab.orgao && <span style={{ color:'#374151' }}> · {colab.orgao}</span>}
                {colab.funcao && <span style={{ color:'#374151' }}> · {colab.funcao}</span>}
              </p>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              {(['epis','assinar'] as const).map((s,i)=>(
                <div key={s} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:22, height:22, borderRadius:'50%', display:'flex',
                    alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700,
                    background: step===s ? '#A855F7' : (step==='assinar'&&s==='epis') ? '#00E676' : 'rgba(255,255,255,0.07)',
                    color:'#fff', flexShrink:0 }}>
                    {step==='assinar'&&s==='epis' ? <Check size={10}/> : i+1}
                  </div>
                  <span style={{ fontSize:11, fontWeight:600, color: step===s ? '#C084FC':'#4B5563' }}>
                    {s==='epis' ? 'Seleção de EPIs' : 'Assinaturas'}
                  </span>
                  {i===0 && <span style={{ fontSize:11, color:'#1F2937', margin:'0 4px' }}>›</span>}
                </div>
              ))}
            </div>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.04)',
              border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, cursor:'pointer',
              color:'#6B7280', padding:'6px', display:'flex', alignItems:'center' }}>
              <X size={15}/>
            </button>
          </div>
        </div>

        {/* STEP 1 */}
        {step==='epis' && (
          <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

            {/* Left: catalog */}
            <div style={{ flex:'0 0 62%', borderRight:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column', overflow:'hidden' }}>

              {/* Group tabs — pill style com cor de acento */}
              <div style={{ padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,0.06)',
                display:'flex', gap:6, flexWrap:'wrap', flexShrink:0, alignItems:'center' }}>
                {loadingCat && (
                  <div style={{ display:'flex', alignItems:'center', gap:6, color:'#4B5563', fontSize:12 }}>
                    <Loader2 size={13} style={{ animation:'spin 0.8s linear infinite' }}/> Carregando catálogo…
                  </div>
                )}
                {grupos.map(g => {
                  const ga = grupoAccent(g.nome);
                  const isSel = grupo === g.nome;
                  return (
                    <button key={g.nome} onClick={()=>handleGroupSelect(g.nome)}
                      style={{ padding:'5px 13px', fontSize:11, fontWeight:700, borderRadius:20, cursor:'pointer',
                        border:`1px solid ${isSel ? ga+'55' : 'rgba(255,255,255,0.08)'}`,
                        background: isSel ? ga+'18' : 'rgba(255,255,255,0.03)',
                        color: isSel ? ga : '#4B5563', transition:'all 0.15s',
                        display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background: isSel ? ga : '#374151', flexShrink:0 }}/>
                      {g.nome}
                      <span style={{ opacity:0.6, fontWeight:400 }}>({g.items.length})</span>
                      {g.nome===detectedGrupo && <span style={{ fontSize:9, background:'rgba(0,230,118,0.15)', color:'#00E676', padding:'1px 5px', borderRadius:8, fontWeight:700 }}>auto</span>}
                    </button>
                  );
                })}
              </div>

              {/* Grid de EPIs */}
              <div style={{ overflowY:'auto', flex:1, padding:14,
                display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:10, alignContent:'start' }}>
                {grupoItems.map(item => {
                  const sel = selected.has(item.id);
                  const corHex = corCss(item.cor);
                  return (
                    <div key={item.id} onClick={()=>toggle(item)}
                      style={{ borderRadius:12, cursor:'pointer', transition:'all 0.18s', position:'relative',
                        overflow:'hidden',
                        border: sel ? `2px solid ${accent}` : '1px solid rgba(255,255,255,0.08)',
                        background: sel ? `${accent}10` : 'rgba(255,255,255,0.025)',
                        boxShadow: sel ? `0 0 18px ${accent}20` : 'none' }}>

                      {/* Barra de cor no topo */}
                      <div style={{ height:5, background: item.cor ? `linear-gradient(90deg,${corHex},${corHex}88)` : 'rgba(255,255,255,0.05)' }}/>

                      <div style={{ padding:'10px 12px' }}>
                        {/* Check overlay */}
                        {sel && (
                          <div style={{ position:'absolute', top:12, right:10,
                            width:20, height:20, borderRadius:'50%', background:accent,
                            display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <Check size={11} color="#fff"/>
                          </div>
                        )}

                        <p style={{ fontSize:12, fontWeight:700, color: sel ? '#F9FAFB' : '#D1D5DB',
                          margin:'0 0 6px', lineHeight:1.35, paddingRight: sel ? 24 : 0 }}>{item.nome}</p>

                        {/* Badges */}
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
                          {item.ca && (
                            <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:9,
                              fontWeight:700, padding:'2px 6px', borderRadius:10,
                              background:'rgba(0,229,255,0.10)', color:'#00E5FF' }}>
                              <ShieldCheck size={8}/> {item.ca}
                            </span>
                          )}
                          {item.cor && (
                            <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:9,
                              fontWeight:600, padding:'2px 6px', borderRadius:10,
                              background:`${corHex}18`, color:corHex }}>
                              <span style={{ width:6, height:6, borderRadius:'50%', background:corHex }}/>
                              {item.cor}
                            </span>
                          )}
                        </div>

                        {item.descricao && (
                          <p style={{ fontSize:10, color:'#4B5563', margin:'0 0 8px',
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                            title={item.descricao}>{item.descricao}</p>
                        )}

                        {/* Preço */}
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <Tag size={10} color={ sel ? accent : '#6B7280' }/>
                          <span style={{ fontSize:12, fontWeight:700, color: sel ? accent : '#6B7280' }}>
                            {item.preco > 0 ? `R$ ${item.preco.toFixed(2)}` : 'Sem preço'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!loadingCat && grupoItems.length===0 && (
                  <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'50px 20px' }}>
                    <Package2 size={32} color="#1F2937" style={{ marginBottom:10 }}/>
                    <p style={{ fontSize:13, color:'#374151' }}>Nenhum item neste grupo.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: selected */}
            <div style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden' }}>
              <div style={{ padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0 }}>
                <p style={{ fontSize:10,fontWeight:700,letterSpacing:'0.8px',textTransform:'uppercase',color:'#4B5563',margin:0 }}>Selecionados ({selArr.length})</p>
              </div>
              <div style={{ overflowY:'auto', flex:1, padding:'12px 14px' }}>
                {selArr.length===0 && (
                  <div style={{ textAlign:'center', marginTop:60 }}>
                    <Package2 size={32} color="#374151" style={{ marginBottom:12 }}/>
                    <p style={{ fontSize:13, color:'#4B5563', lineHeight:1.6, margin:0 }}>
                      Nenhum EPI selecionado.<br/>Clique nos cards ao lado para adicionar.
                    </p>
                  </div>
                )}
                {selArr.map(epi => {
                  const corHex = corCss(epi.item.cor);
                  return (
                    <div key={epi.item.id}
                      style={{ marginBottom:12, padding:'12px 14px', borderRadius:12,
                        background:'rgba(255,255,255,0.02)', border:'1px solid rgba(168,85,247,0.20)',
                        boxShadow:'0 4px 12px rgba(0,0,0,0.2)' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                        <div>
                          <p style={{ fontSize:13, fontWeight:700, color:'#E5E7EB', margin:'0 0 4px', paddingRight:8 }}>
                            {epi.item.nome}
                          </p>
                          {epi.item.cor && (
                            <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:9,
                              fontWeight:600, padding:'2px 6px', borderRadius:10,
                              background:`${corHex}15`, color:corHex }}>
                              <span style={{ width:6, height:6, borderRadius:'50%', background:corHex }}/>
                              {epi.item.cor}
                            </span>
                          )}
                        </div>
                        <button onClick={()=>rem(epi.item.id)}
                          style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
                            borderRadius:6, cursor:'pointer', color:'#EF4444', padding:'5px',
                            display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <Trash2 size={13}/>
                        </button>
                      </div>

                      {/* Tamanho — pills visuais */}
                      <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase',
                        color:'#6B7280', margin:'0 0 6px' }}>Tamanho</p>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:14 }}>
                        {TAMANHOS.map(t => {
                          const isSel = epi.tamanho === t;
                          return (
                            <button key={t} type="button" onClick={()=>setTam(epi.item.id,t)}
                              style={{ padding:'4px 10px', borderRadius:8, fontSize:11, cursor:'pointer',
                                fontWeight: isSel ? 700 : 500, transition:'all 0.15s',
                                background: isSel ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.03)',
                                border: isSel ? '1px solid rgba(168,85,247,0.50)' : '1px solid rgba(255,255,255,0.08)',
                                color: isSel ? '#C084FC' : '#9CA3AF' }}>
                              {t}
                            </button>
                          );
                        })}
                      </div>

                      {/* Quantidade */}
                      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between' }}>
                        <div>
                          <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase',
                            color:'#6B7280', margin:'0 0 6px' }}>Quantidade</p>
                          <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.02)',
                            border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:4 }}>
                            <button type="button" onClick={()=>setQtd(epi.item.id, epi.quantidade-1)}
                              style={{ width:26, height:26, borderRadius:6, display:'flex', alignItems:'center',
                                justifyContent:'center', background:'rgba(255,255,255,0.05)', border:'none',
                                cursor:'pointer', color:'#9CA3AF' }}>
                              <Minus size={12}/>
                            </button>
                            <span style={{ fontSize:14, fontWeight:700, color:'#F3F4F6', minWidth:24, textAlign:'center' }}>
                              {epi.quantidade}
                            </span>
                            <button type="button" onClick={()=>setQtd(epi.item.id, epi.quantidade+1)}
                              style={{ width:26, height:26, borderRadius:6, display:'flex', alignItems:'center',
                                justifyContent:'center', background:'rgba(255,255,255,0.05)', border:'none',
                                cursor:'pointer', color:'#9CA3AF' }}>
                              <Plus size={12}/>
                            </button>
                          </div>
                        </div>

                        {/* Subtotal */}
                        <div style={{ textAlign:'right' }}>
                          {epi.item.preco > 0 ? (
                            <>
                              <p style={{ fontSize:10, color:'#6B7280', margin:'0 0 2px' }}>
                                {epi.quantidade}x R$ {epi.item.preco.toFixed(2)}
                              </p>
                              <p style={{ fontSize:13, fontWeight:700, color:'#A855F7', margin:0 }}>
                                R$ {(epi.item.preco * epi.quantidade).toFixed(2)}
                              </p>
                            </>
                          ) : (
                            <p style={{ fontSize:11, color:'#6B7280', margin:0 }}>Sem preço</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ padding:'10px 12px',borderTop:'1px solid rgba(255,255,255,0.06)',flexShrink:0 }}>
                {total>0 && <p style={{ fontSize:11,color:'#6B7280',margin:'0 0 8px' }}>Total: <strong style={{ color:'#C084FC' }}>R$ {total.toFixed(2)}</strong></p>}
                <button disabled={selArr.length===0} onClick={()=>setStep('assinar')}
                  style={{ width:'100%',padding:'10px',borderRadius:10,fontSize:13,fontWeight:700,cursor:selArr.length===0?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,border:'none',background:selArr.length>0?'rgba(168,85,247,0.2)':'rgba(255,255,255,0.04)',color:selArr.length>0?'#C084FC':'#4B5563',opacity:selArr.length===0?0.5:1 }}>
                  Próximo: Assinaturas <ChevronRight size={14}/>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step==='assinar' && (
          <div style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden' }}>
            <div style={{ flex:1,display:'grid',gridTemplateColumns:'1fr 1fr',overflow:'hidden' }}>
              {[{ ref:sigColabRef,label:'Assinatura do Colaborador',sub:colab.nome,err:sigColabErr,setErr:setSigColabErr },
                { ref:sigTecRef,  label:'Assinatura do Técnico (SESMT)',sub:tecnico,err:sigTecErr,setErr:setSigTecErr }
              ].map((s,i)=>(
                <div key={i} style={{ ...(i===0?{borderRight:'1px solid rgba(255,255,255,0.07)'}:{}),padding:'18px 22px',display:'flex',flexDirection:'column' }}>
                  <p style={{ fontSize:13,fontWeight:700,color:'#E5E7EB',margin:'0 0 2px' }}>{s.label}</p>
                  <p style={{ fontSize:11,color:'#6B7280',margin:'0 0 10px' }}>{s.sub}</p>
                  <div style={{ flex:1,border:'1px solid rgba(255,255,255,0.12)',borderRadius:10,overflow:'hidden',background:'#fff',minHeight:160 }}>
                    <SignatureCanvas ref={s.ref} penColor="#1a1a1a" canvasProps={{ style:{ width:'100%',height:'100%',display:'block' } }} onBegin={()=>s.setErr('')}/>
                  </div>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:7 }}>
                    <button onClick={()=>s.ref.current?.clear()} style={{ fontSize:11,color:'#6B7280',background:'none',border:'none',cursor:'pointer',textDecoration:'underline' }}>Limpar</button>
                    {s.err && <span style={{ fontSize:11,color:'#EF4444',display:'flex',alignItems:'center',gap:4 }}><AlertCircle size={11}/> {s.err}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding:'12px 20px',borderTop:'1px solid rgba(255,255,255,0.07)',display:'flex',gap:10,alignItems:'center',flexShrink:0 }}>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:11,color:'#6B7280',margin:0 }}>
                  <strong style={{ color:'#9CA3AF' }}>{selArr.length} EPI(s)</strong> · {colab.orgao||'—'}
                  {total>0 && <> · Total: <strong style={{ color:'#C084FC' }}>R$ {total.toFixed(2)}</strong></>}
                </p>
              </div>
              <button onClick={()=>setStep('epis')} style={{ padding:'9px 16px',borderRadius:10,fontSize:13,cursor:'pointer',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:'#9CA3AF' }}>← Voltar</button>
              <button onClick={()=>mut.mutate()} disabled={mut.isPending} style={{ padding:'9px 22px',borderRadius:10,fontSize:13,fontWeight:700,cursor:mut.isPending?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:8,border:'1px solid rgba(0,230,118,0.35)',background:'rgba(0,230,118,0.12)',color:'#00E676',opacity:mut.isPending?0.7:1 }}>
                {mut.isPending?<Loader2 size={14} style={{ animation:'spin 0.8s linear infinite' }}/>:<Check size={14}/>}
                {mut.isPending?'Gerando PDF…':'Confirmar e Gerar PDF'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

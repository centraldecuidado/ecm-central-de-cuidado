import { useEffect, useRef, useState } from 'react'
import { Braces, FileText, RefreshCw, Send } from 'lucide-react'
import { useDialogos } from '@/components/dialogos-contexto'
import { criarModeloDoWhatsApp, getCurrentMembership, listarModelosDoWhatsApp } from '@/lib/repository'
import {
  CATEGORIAS,
  nomeDoModelo,
  quantasVariaveis,
  textoComExemplos,
  validarModelo,
  type CategoriaDoModelo,
  type ModeloDaMeta,
} from '../../supabase/functions/_shared/modelo-de-mensagem.ts'

const OPCOES_DE_CATEGORIA: { valor: CategoriaDoModelo; explica: string }[] = [
  { valor: 'UTILITY', explica: 'Avisos sobre um atendimento: lembrete, confirmação, retorno, exame pronto.' },
  { valor: 'MARKETING', explica: 'Novidades e campanhas. A Meta cobra mais e o paciente pode bloquear.' },
]

const COR_DA_SITUACAO: Record<string, string> = {
  APPROVED: 'bg-[#e3f3e8] text-[#1c6b3a]',
  PENDING: 'bg-[#fdf1dc] text-[#9a5a1c]',
  IN_APPEAL: 'bg-[#fdf1dc] text-[#9a5a1c]',
  REJECTED: 'bg-red-50 text-red-600',
  PAUSED: 'bg-red-50 text-red-600',
  DISABLED: 'bg-red-50 text-red-600',
}

/**
 * Modelos de mensagem do WhatsApp (28/10/2026).
 *
 * Fora de uma conversa aberta, o WhatsApp so entrega mensagem de modelo
 * aprovado pela Meta. Aqui a clinica ve os modelos da conta e cria um novo,
 * que vai direto para a analise da Meta (funcao whatsapp-modelos). Antes isso
 * era feito a mao no Gerenciador do WhatsApp, fora do sistema. As regras da
 * Meta ficam em supabase/functions/_shared/modelo-de-mensagem.ts, usadas aqui
 * e na funcao.
 */
export default function ModelosDeMensagem() {
  const { avisar, perguntar } = useDialogos()
  const [modelos, setModelos] = useState<ModeloDaMeta[] | null>(null)
  const [erroDaLista, setErroDaLista] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [responsavel, setResponsavel] = useState(false)

  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState<CategoriaDoModelo>('UTILITY')
  const [texto, setTexto] = useState('')
  const [exemplos, setExemplos] = useState<string[]>([])
  const [rodape, setRodape] = useState('')
  const [enviando, setEnviando] = useState(false)
  const caixaDoTexto = useRef<HTMLTextAreaElement>(null)

  const nome = nomeDoModelo(titulo)
  const variaveis = quantasVariaveis(texto)
  const conferido = validarModelo({ nome, categoria, texto, exemplos, rodape })
  const comecou = titulo.trim() !== '' || texto.trim() !== ''

  async function carregar() {
    setCarregando(true)
    setErroDaLista('')
    try {
      setModelos(await listarModelosDoWhatsApp())
    } catch (causa) {
      setErroDaLista(causa instanceof Error ? causa.message : 'Não foi possível consultar os modelos.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar()
    void (async () => {
      try {
        const membership = await getCurrentMembership()
        setResponsavel(membership?.role === 'owner')
      } catch {
        // Sem o papel, a tela so mostra a lista.
      }
    })()
  }, [])

  // Uma caixa de exemplo para cada variavel que o texto usa.
  useEffect(() => {
    setExemplos((atuais) => Array.from({ length: variaveis }, (_, i) => atuais[i] ?? ''))
  }, [variaveis])

  function inserirVariavel() {
    const marca = `{{${variaveis + 1}}}`
    const caixa = caixaDoTexto.current
    const inicio = caixa?.selectionStart ?? texto.length
    const fim = caixa?.selectionEnd ?? texto.length
    const novo = texto.slice(0, inicio) + marca + texto.slice(fim)
    setTexto(novo)
    window.requestAnimationFrame(() => {
      caixa?.focus()
      caixa?.setSelectionRange(inicio + marca.length, inicio + marca.length)
    })
  }

  async function enviar() {
    if (!conferido.ok || enviando) return
    const certeza = await perguntar({
      titulo: 'Enviar o modelo para a análise da Meta?',
      detalhe:
        'A Meta costuma responder entre alguns minutos e dois dias. Depois de enviado, o texto não muda: para corrigir, crie outro modelo.',
      confirmar: 'Enviar para a Meta',
    })
    if (!certeza) return
    setEnviando(true)
    try {
      await criarModeloDoWhatsApp({ nome, categoria, texto, exemplos, rodape })
      setTitulo('')
      setTexto('')
      setExemplos([])
      setRodape('')
      avisar(`Modelo "${nome}" enviado. Ele aparece na lista como "Em análise" até a Meta responder.`)
      await carregar()
    } catch (causa) {
      avisar(causa instanceof Error ? causa.message : 'Não foi possível enviar o modelo para a Meta.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="surface-card overflow-hidden rounded-[26px]">
      <div className="border-b border-[#081b2c]/[0.06] bg-gradient-to-r from-white to-[#f0f6fc] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#dceaf7] text-[#1f4f78]">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#1f4f78]">WhatsApp</p>
            <h2 className="mt-1 text-base font-extrabold tracking-[-0.03em] text-[#081b2c]">Modelos de mensagem</h2>
            <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-slate-400">
              Fora de uma conversa aberta, o WhatsApp só entrega mensagens de um modelo aprovado pela Meta. Aqui
              estão os modelos da clínica, e um modelo novo vai direto para a análise da Meta.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void carregar()}
            disabled={carregando}
            title="Atualizar a lista"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#081b2c]/10 bg-white text-[#1f4f78] transition hover:bg-[#f3f6f9] disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="space-y-2">
          <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">Modelos na Meta</p>
          {erroDaLista && <p className="text-[10px] font-bold leading-relaxed text-red-500">{erroDaLista}</p>}
          {!erroDaLista && modelos === null && <p className="text-[10px] font-semibold text-slate-400">Carregando...</p>}
          {modelos?.length === 0 && (
            <p className="text-[10px] font-semibold text-slate-400">Nenhum modelo nesta conta ainda.</p>
          )}
          {modelos && modelos.length > 0 && (
            <ul className="space-y-2">
              {modelos.map((modelo) => (
                <li key={modelo.id || `${modelo.nome}-${modelo.idioma}`} className="rounded-[16px] border border-[#081b2c]/[0.07] bg-white px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-[#081b2c]">{modelo.nome}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${COR_DA_SITUACAO[modelo.status] ?? 'bg-[#f1f3f5] text-slate-500'}`}>
                      {modelo.situacao}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400">
                      {modelo.categoria} · {modelo.idioma}
                    </span>
                  </div>
                  {modelo.texto && (
                    <p className="mt-1.5 line-clamp-2 whitespace-pre-line text-[10px] leading-relaxed text-slate-500">{modelo.texto}</p>
                  )}
                  {modelo.motivo && (
                    <p className="mt-1 text-[10px] font-bold text-red-500">Motivo da Meta: {modelo.motivo}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-[20px] border border-[#081b2c]/[0.07] bg-[#fafaf8] p-4 sm:p-5">
          <p className="text-[11px] font-extrabold text-[#081b2c]">Criar um modelo</p>
          {!responsavel ? (
            <p className="mt-1 text-[10px] font-semibold text-slate-400">Só o responsável pela clínica cria modelos.</p>
          ) : (
            <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="space-y-3">
                <label className="block">
                  <span className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">Nome</span>
                  <input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Lembrete de retorno"
                    maxLength={120}
                    className="mt-1 w-full rounded-xl border border-[#081b2c]/10 bg-white px-3 py-2 text-[11px] font-semibold text-[#081b2c] outline-none focus:border-[#2f7fc1]"
                  />
                  {nome && (
                    <span className="mt-1 block text-[9px] font-semibold text-slate-400">
                      Vai para a Meta como <span className="font-mono text-[#1f4f78]">{nome}</span>
                    </span>
                  )}
                </label>

                <div>
                  <span className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">Categoria</span>
                  <div role="radiogroup" aria-label="Categoria do modelo" className="mt-1 grid gap-2 sm:grid-cols-2">
                    {OPCOES_DE_CATEGORIA.map((opcao) => {
                      const escolhida = categoria === opcao.valor
                      return (
                        <button
                          key={opcao.valor}
                          type="button"
                          role="radio"
                          aria-checked={escolhida}
                          onClick={() => setCategoria(opcao.valor)}
                          className={`rounded-[14px] border px-3 py-2.5 text-left transition ${
                            escolhida
                              ? 'border-[#081b2c] bg-[#081b2c] text-white'
                              : 'border-[#081b2c]/10 bg-white text-[#081b2c] hover:border-[#2f7fc1]'
                          }`}
                        >
                          <span className="block text-[11px] font-extrabold">{CATEGORIAS[opcao.valor]}</span>
                          <span className={`mt-0.5 block text-[9px] leading-relaxed ${escolhida ? 'text-white/70' : 'text-slate-400'}`}>
                            {opcao.explica}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <label className="block">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">Texto da mensagem</span>
                    <button
                      type="button"
                      onClick={inserirVariavel}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#081b2c]/10 bg-white px-2 py-1 text-[9px] font-extrabold text-[#1f4f78] transition hover:bg-[#f3f6f9]"
                    >
                      <Braces className="h-3 w-3" />
                      Inserir variável
                    </button>
                  </span>
                  <textarea
                    ref={caixaDoTexto}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    rows={5}
                    maxLength={1024}
                    placeholder={'Olá, {{1}}. Aqui é do consultório. Sua consulta de retorno está chegando: {{2}}. Responda esta mensagem para confirmar.'}
                    className="mt-1 w-full resize-y rounded-xl border border-[#081b2c]/10 bg-white px-3 py-2 text-[11px] leading-relaxed text-[#081b2c] outline-none focus:border-[#2f7fc1]"
                  />
                  <span className="mt-0.5 block text-right text-[9px] font-semibold text-slate-400">{texto.length}/1024</span>
                </label>

                {exemplos.map((exemplo, i) => (
                  <label key={i} className="block">
                    <span className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">
                      Exemplo para {`{{${i + 1}}}`}
                    </span>
                    <input
                      value={exemplo}
                      onChange={(e) => setExemplos(exemplos.map((atual, j) => (j === i ? e.target.value : atual)))}
                      placeholder={i === 0 ? 'Maria' : 'terça, 4 de novembro, às 14h'}
                      className="mt-1 w-full rounded-xl border border-[#081b2c]/10 bg-white px-3 py-2 text-[11px] font-semibold text-[#081b2c] outline-none focus:border-[#2f7fc1]"
                    />
                  </label>
                ))}

                <label className="block">
                  <span className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">Rodapé (opcional)</span>
                  <input
                    value={rodape}
                    onChange={(e) => setRodape(e.target.value)}
                    maxLength={60}
                    placeholder="Para não receber mais, responda SAIR."
                    className="mt-1 w-full rounded-xl border border-[#081b2c]/10 bg-white px-3 py-2 text-[11px] font-semibold text-[#081b2c] outline-none focus:border-[#2f7fc1]"
                  />
                </label>
              </div>

              <div className="space-y-3">
                <span className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">Como o paciente vai ler</span>
                <div className="rounded-[18px] bg-[#efeae2] p-3">
                  <div className="rounded-[12px] rounded-tl-none bg-white p-3 text-[11px] leading-relaxed text-[#203546] shadow-sm">
                    <p className="whitespace-pre-line">
                      {texto.trim() ? textoComExemplos(texto, exemplos) : 'O texto aparece aqui enquanto você escreve.'}
                    </p>
                    {rodape.trim() && <p className="mt-2 text-[10px] text-slate-400">{rodape}</p>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void enviar()}
                  disabled={!conferido.ok || enviando}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#081b2c] px-4 py-2.5 text-[10px] font-extrabold text-white transition hover:bg-[#102d47] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {enviando ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {enviando ? 'Enviando para a Meta...' : 'Enviar para análise da Meta'}
                </button>
                {comecou && !conferido.ok && (
                  <p className="text-[10px] font-bold leading-relaxed text-[#9a5a1c]">{conferido.erro}</p>
                )}
                <p className="text-[9px] leading-relaxed text-slate-400">
                  Idioma: português (Brasil). Depois de aprovado, o modelo não muda; para corrigir, crie outro.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

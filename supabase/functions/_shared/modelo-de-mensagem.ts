/**
 * Modelos de mensagem do WhatsApp criados pela propria Central (28/10/2026).
 *
 * Fora de uma conversa aberta, o WhatsApp so entrega mensagem de modelo
 * aprovado pela Meta. Ate aqui cada modelo era criado a mao no Gerenciador do
 * WhatsApp, fora do sistema. Agora a clinica escreve o texto em Preferencias e
 * a funcao whatsapp-modelos manda para a analise da Meta. Tambem e o que a
 * analise do app da ECM pede para ver em video (permissao
 * whatsapp_business_management).
 *
 * As regras abaixo sao as que a Meta aplica, conferidas aqui antes de enviar:
 * barrar na tela custa menos do que esperar a Meta recusar.
 *
 * Este arquivo nao fala com a Meta nem com o banco: a tela e a funcao usam as
 * mesmas regras, e os testes rodam sem Deno.
 */

export type CategoriaDoModelo = 'UTILITY' | 'MARKETING'

export const CATEGORIAS: Record<string, string> = {
  UTILITY: 'Utilidade',
  MARKETING: 'Marketing',
  AUTHENTICATION: 'Autenticação',
}

/** O que a Meta aceita no nome: letras minusculas, numeros e sublinhado. */
const NOME_VALIDO = /^[a-z0-9_]{1,512}$/
const LIMITE_DO_TEXTO = 1024
const LIMITE_DO_RODAPE = 60
const VARIAVEL = /\{\{(\d+)\}\}/g
// Sem o g: o test() de uma expressao com g guarda a posicao entre chamadas.
const TEM_VARIAVEL = /\{\{\d+\}\}/

export interface PedidoDeModelo {
  nome: string
  categoria: string
  idioma?: string
  texto: string
  exemplos?: string[]
  rodape?: string
}

export type ModeloValidado =
  | { ok: true; corpo: Record<string, unknown> }
  | { ok: false; erro: string }

/**
 * O nome que a Meta aceita a partir do que a pessoa digitou.
 *
 * "Lembrete de retorno" vira "lembrete_de_retorno": sem acento, sem espaco,
 * tudo minusculo. Assim ninguem precisa conhecer a regra da Meta.
 */
export function nomeDoModelo(titulo: string): string {
  return titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 512)
}

/** Os numeros das variaveis do texto, na ordem em que aparecem. */
export function variaveisDoTexto(texto: string): number[] {
  return [...texto.matchAll(VARIAVEL)].map((m) => Number(m[1]))
}

/** Quantas variaveis diferentes o texto usa ({{1}} duas vezes conta uma). */
export function quantasVariaveis(texto: string): number {
  return new Set(variaveisDoTexto(texto)).size
}

/** O texto com os exemplos no lugar das variaveis, como a pessoa vai ler. */
export function textoComExemplos(texto: string, exemplos: string[]): string {
  return texto.replace(VARIAVEL, (marca, numero: string) => {
    const exemplo = exemplos[Number(numero) - 1]?.trim()
    return exemplo || marca
  })
}

/**
 * Confere o pedido e monta o corpo que vai para a Meta.
 *
 * Regras da Meta que valem a pena barrar antes:
 * - variaveis numeradas em sequencia, de {{1}} em diante, sem pular;
 * - um exemplo para cada variavel (sem exemplo a Meta recusa na hora);
 * - o texto nao pode comecar nem terminar com uma variavel;
 * - texto ate 1024 caracteres e rodape ate 60, sem variavel no rodape.
 */
export function validarModelo(pedido: PedidoDeModelo): ModeloValidado {
  const nome = (pedido.nome ?? '').trim()
  const texto = (pedido.texto ?? '').trim()
  const rodape = (pedido.rodape ?? '').trim()
  const idioma = (pedido.idioma ?? 'pt_BR').trim()
  const exemplos = (pedido.exemplos ?? []).map((e) => String(e ?? '').trim())

  if (!NOME_VALIDO.test(nome)) {
    return { ok: false, erro: 'Dê um nome ao modelo (só letras, números e sublinhado).' }
  }
  if (pedido.categoria !== 'UTILITY' && pedido.categoria !== 'MARKETING') {
    return { ok: false, erro: 'Escolha a categoria: Utilidade ou Marketing.' }
  }
  if (!/^[a-z]{2}(_[A-Z]{2})?$/.test(idioma)) {
    return { ok: false, erro: 'Idioma inválido.' }
  }
  if (!texto) return { ok: false, erro: 'Escreva o texto da mensagem.' }
  if (texto.length > LIMITE_DO_TEXTO) {
    return { ok: false, erro: `O texto passou de ${LIMITE_DO_TEXTO} caracteres.` }
  }

  const usadas = [...new Set(variaveisDoTexto(texto))].sort((a, b) => a - b)
  if (usadas.some((n, i) => n !== i + 1)) {
    return { ok: false, erro: 'Numere as variáveis em sequência: {{1}}, {{2}}, {{3}}...' }
  }
  if (/^\{\{\d+\}\}/.test(texto) || /\{\{\d+\}\}$/.test(texto)) {
    return { ok: false, erro: 'A Meta não aceita texto que comece ou termine com uma variável.' }
  }
  if (exemplos.length < usadas.length || exemplos.slice(0, usadas.length).some((e) => !e)) {
    return { ok: false, erro: 'Escreva um exemplo para cada variável.' }
  }

  if (rodape.length > LIMITE_DO_RODAPE) {
    return { ok: false, erro: `O rodapé passou de ${LIMITE_DO_RODAPE} caracteres.` }
  }
  if (TEM_VARIAVEL.test(rodape)) {
    return { ok: false, erro: 'O rodapé não pode ter variável.' }
  }

  const corpoDoTexto: Record<string, unknown> = { type: 'BODY', text: texto }
  if (usadas.length) {
    // A Meta quer uma lista de listas: um conjunto de exemplos por mensagem.
    corpoDoTexto.example = { body_text: [exemplos.slice(0, usadas.length)] }
  }
  const componentes: Record<string, unknown>[] = [corpoDoTexto]
  if (rodape) componentes.push({ type: 'FOOTER', text: rodape })

  return {
    ok: true,
    corpo: { name: nome, language: idioma, category: pedido.categoria, components: componentes },
  }
}

const SITUACOES: Record<string, string> = {
  APPROVED: 'Aprovado',
  PENDING: 'Em análise',
  IN_APPEAL: 'Em recurso',
  REJECTED: 'Recusado',
  PAUSED: 'Pausado',
  DISABLED: 'Desativado',
  PENDING_DELETION: 'Sendo apagado',
  DELETED: 'Apagado',
  LIMIT_EXCEEDED: 'Limite excedido',
}

export function situacaoDoModelo(status: unknown): string {
  return typeof status === 'string' ? SITUACOES[status] ?? status : 'Não informado'
}

export interface ModeloDaMeta {
  id: string
  nome: string
  status: string
  situacao: string
  categoria: string
  idioma: string
  texto: string
  motivo: string | null
}

/** A lista que a Meta devolve, no formato da tela. */
export function resumirModelos(resposta: unknown): ModeloDaMeta[] {
  const lista = (resposta as { data?: unknown[] } | null)?.data
  if (!Array.isArray(lista)) return []
  return lista.map((item) => {
    const m = item as Record<string, unknown>
    const componentes = Array.isArray(m.components) ? (m.components as Record<string, unknown>[]) : []
    const corpo = componentes.find((c) => c.type === 'BODY')
    const motivo = typeof m.rejected_reason === 'string' && m.rejected_reason !== 'NONE' ? m.rejected_reason : null
    return {
      id: String(m.id ?? ''),
      nome: String(m.name ?? ''),
      status: String(m.status ?? ''),
      situacao: situacaoDoModelo(m.status),
      categoria: CATEGORIAS[String(m.category ?? '')] ?? String(m.category ?? ''),
      idioma: String(m.language ?? ''),
      texto: typeof corpo?.text === 'string' ? corpo.text : '',
      motivo,
    }
  })
}

/**
 * O motivo que a Meta deu, em uma linha.
 *
 * A Meta manda o motivo legivel em error_user_msg (as vezes com um titulo em
 * error_user_title) e o tecnico em message. O legivel vem primeiro: e o que a
 * pessoa consegue corrigir sozinha, como "ja existe um modelo com esse nome".
 */
export function motivoDaMeta(resposta: unknown): string {
  const erro = (resposta as { error?: Record<string, unknown> } | null)?.error
  if (!erro) return 'A Meta não explicou o motivo.'
  const partes = [erro.error_user_title, erro.error_user_msg].filter(
    (p): p is string => typeof p === 'string' && p.trim() !== '',
  )
  if (partes.length) return partes.join(': ')
  return typeof erro.message === 'string' && erro.message ? erro.message : 'A Meta não explicou o motivo.'
}

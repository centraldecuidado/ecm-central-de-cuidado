// Modelos de mensagem criados pela Central (28/10/2026). Ver
// supabase/functions/_shared/modelo-de-mensagem.ts. Sem Meta e sem banco: so
// as regras que a tela e a funcao whatsapp-modelos conferem antes de enviar.
// Para provar que um caso pega o defeito, ver DESLIGAR em
// tests/montar-para-teste.mjs.
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { conferirDesligar, montar } from './montar-para-teste.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const M = await montar(
  join(AQUI, '..', 'supabase', 'functions', '_shared', 'modelo-de-mensagem.ts'),
  join(AQUI, 'modelo-de-mensagem.build.mjs'),
)

let ok = 0
function caso(nome, fn) {
  try {
    fn()
    ok++
  } catch (erro) {
    console.error(`FALHOU: ${nome}`)
    throw erro
  }
}

const base = {
  nome: 'lembrete_de_retorno',
  categoria: 'UTILITY',
  texto: 'Olá, {{1}}. Seu retorno está marcado para {{2}}. Responda para confirmar.',
  exemplos: ['Maria', 'terça às 14h'],
}

caso('nome: sem acento, sem espaço, minúsculo', () => {
  assert.equal(M.nomeDoModelo('Lembrete de Retórno: Ação!'), 'lembrete_de_retorno_acao')
  assert.equal(M.nomeDoModelo('  __Exame pronto__  '), 'exame_pronto')
})

caso('modelo certo: corpo da Meta com exemplos em lista de listas', () => {
  const r = M.validarModelo(base)
  assert.equal(r.ok, true, r.erro)
  assert.deepEqual(r.corpo, {
    name: 'lembrete_de_retorno',
    language: 'pt_BR',
    category: 'UTILITY',
    components: [{ type: 'BODY', text: base.texto, example: { body_text: [['Maria', 'terça às 14h']] } }],
  })
})

caso('sem variável: não manda exemplo', () => {
  const r = M.validarModelo({ ...base, texto: 'Seu exame está pronto. Responda para combinar a entrega.', exemplos: [] })
  assert.equal(r.ok, true, r.erro)
  assert.equal(r.corpo.components[0].example, undefined)
})

caso('rodapé vira FOOTER', () => {
  const r = M.validarModelo({ ...base, rodape: 'Para não receber mais, responda SAIR.' })
  assert.equal(r.ok, true, r.erro)
  assert.deepEqual(r.corpo.components[1], { type: 'FOOTER', text: 'Para não receber mais, responda SAIR.' })
})

caso('variáveis fora de sequência: recusa', () => {
  const r = M.validarModelo({ ...base, texto: 'Olá, {{1}}. Seu retorno é {{3}}. Responda.', exemplos: ['a', 'b', 'c'] })
  assert.equal(r.ok, false)
  assert.match(r.erro, /sequência/)
})

caso('a mesma variável duas vezes conta uma', () => {
  const r = M.validarModelo({ ...base, texto: 'Olá, {{1}}. Até logo, {{1}}. Responda.', exemplos: ['Maria'] })
  assert.equal(r.ok, true, r.erro)
  assert.equal(M.quantasVariaveis('Olá, {{1}}. Até logo, {{1}} e {{2}}.'), 2)
})

caso('começa ou termina com variável: recusa', () => {
  assert.equal(M.validarModelo({ ...base, texto: '{{1}}, seu retorno é amanhã. Responda.', exemplos: ['Maria'] }).ok, false)
  assert.equal(M.validarModelo({ ...base, texto: 'Seu retorno é {{1}}', exemplos: ['amanhã'] }).ok, false)
})

caso('termina com variável e ponto: aceita', () => {
  const r = M.validarModelo({ ...base, texto: 'Seu retorno é {{1}}.', exemplos: ['amanhã'] })
  assert.equal(r.ok, true, r.erro)
})

caso('falta exemplo: recusa', () => {
  const r = M.validarModelo({ ...base, exemplos: ['Maria', '  '] })
  assert.equal(r.ok, false)
  assert.match(r.erro, /exemplo/)
})

caso('rodapé com variável: recusa', () => {
  const r = M.validarModelo({ ...base, rodape: 'Atenciosamente, {{1}}' })
  assert.equal(r.ok, false)
  assert.match(r.erro, /rodapé/)
})

caso('um rodapé recusado não estraga a conferência seguinte', () => {
  // Uma expressão com g guarda a posição entre chamadas: o próximo modelo
  // começaria a procurar variáveis do meio do texto.
  assert.equal(M.validarModelo({ ...base, rodape: 'Equipe {{1}}' }).ok, false)
  const r = M.validarModelo(base)
  assert.equal(r.ok, true, r.erro)
})

caso('categoria, nome e tamanho', () => {
  assert.equal(M.validarModelo({ ...base, categoria: 'AUTHENTICATION' }).ok, false)
  assert.equal(M.validarModelo({ ...base, nome: 'Lembrete de retorno' }).ok, false)
  assert.equal(M.validarModelo({ ...base, nome: '' }).ok, false)
  assert.equal(M.validarModelo({ ...base, texto: `Olá. ${'a'.repeat(1030)}` }).ok, false)
})

caso('prévia: troca as variáveis pelos exemplos e deixa a que não tem', () => {
  assert.equal(M.textoComExemplos('Olá, {{1}}. Dia {{2}}.', ['Maria']), 'Olá, Maria. Dia {{2}}.')
})

caso('lista da Meta no formato da tela', () => {
  const lista = M.resumirModelos({
    data: [
      {
        id: '1',
        name: 'hello_world',
        status: 'APPROVED',
        category: 'UTILITY',
        language: 'en_US',
        rejected_reason: 'NONE',
        components: [{ type: 'HEADER', text: 'Oi' }, { type: 'BODY', text: 'Welcome' }],
      },
      { id: '2', name: 'promo', status: 'REJECTED', category: 'MARKETING', language: 'pt_BR', rejected_reason: 'INVALID_FORMAT' },
    ],
  })
  assert.deepEqual(lista[0], {
    id: '1',
    nome: 'hello_world',
    status: 'APPROVED',
    situacao: 'Aprovado',
    categoria: 'Utilidade',
    idioma: 'en_US',
    texto: 'Welcome',
    motivo: null,
  })
  assert.equal(lista[1].situacao, 'Recusado')
  assert.equal(lista[1].motivo, 'INVALID_FORMAT')
  assert.deepEqual(M.resumirModelos(null), [])
})

caso('motivo da Meta: o legível primeiro', () => {
  assert.equal(
    M.motivoDaMeta({ error: { message: '(#100) Invalid parameter', error_user_title: 'Nome duplicado', error_user_msg: 'Já existe um modelo com esse nome.' } }),
    'Nome duplicado: Já existe um modelo com esse nome.',
  )
  assert.equal(M.motivoDaMeta({ error: { message: '(#100) Invalid parameter' } }), '(#100) Invalid parameter')
  assert.equal(M.motivoDaMeta(null), 'A Meta não explicou o motivo.')
})

conferirDesligar()
console.log(`modelo-de-mensagem: ${ok} casos ok`)

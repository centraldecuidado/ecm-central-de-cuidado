// SQL da clinica da Central de teste da ECM (27/10/2026).
//
// A Central de teste e a copia do sistema do Dr. Fabio. A clinica nasce com os
// mesmos dados do simulador dele (unidades, horarios de exemplo, respostas
// prontas, saudacoes e textos de acompanhamento), trocando o que e dele pelo
// consultorio ficticio das demonstracoes: "Consultorio Central de Cuidado", sem
// nome de medica, com a secretaria Julia. Enderecos e telefones das unidades
// viram ficticios; telefone de unidade sai do texto.
//
// O id da clinica e CLINICA_CENTRAL (quem-atende.ts): e por ele que o robo usa
// o perfil da Central.
//
// Como usar, depois de "npm run test:bot" (que monta tests/simulador.build):
//   node scripts/clinica-central-sql.mjs > clinica.sql
// e cole o conteudo no SQL Editor do Supabase da Central de teste. Roda uma
// vez so: se a clinica ja existir, para sem mudar nada.
import { IDENTIDADES, FAMILIAS, bancoInicial } from '../tests/simulador.build/dados.mjs'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

const quemAtende = readFileSync(new URL('../supabase/functions/_shared/quem-atende.ts', import.meta.url), 'utf8')
const CLINICA = quemAtende.match(/export const CLINICA_CENTRAL = '([0-9a-f-]{36})'/)[1]
const NUMERO_DE_TESTE_DA_ECM = '1450629741458788'

// A ordem importa: as formas mais longas primeiro.
const TROCAS = [
  ['Dr. Fábio Dario | Otorrino', 'Consultório Central de Cuidado'],
  ['ao consultório do Dr. Fábio Dario, médico otorrinolaringologista', 'ao Consultório Central de Cuidado'],
  ['Aqui é o consultório do Dr. Fábio Dario, otorrinolaringologista', 'Aqui é o Consultório Central de Cuidado'],
  ['consultório do Dr. Fábio Dario', 'Consultório Central de Cuidado'],
  ['equipe do Dr. Fábio Dario, otorrinolaringologista', 'equipe do Consultório Central de Cuidado'],
  ['equipe do Dr. Fábio Dario', 'equipe do Consultório Central de Cuidado'],
  ['O Dr. Fábio Dario', 'A médica'],
  ['Dr. Fábio Dario', 'médica'],
  ['do Dr. Fábio', 'da médica'],
  ['ao Dr. Fábio', 'à médica'],
  ['pelo Dr. Fábio', 'pela médica'],
  ['O Dr. Fábio', 'A médica'],
  ['o Dr. Fábio', 'a médica'],
  ['Dr. Fábio', 'médica'],
  ['Dayane', 'Júlia'],
  // "ele" era o Dr. Fabio; o do audio continua "ele".
  ['é nela que ele explica', 'é nela que ela explica'],
  ['Se for necessário, ele indica', 'Se for necessário, ela indica'],
  ['Av. Dr. Conselheiro Nébias, 754, sala 2010, Boqueirão, Santos/SP', 'Rua das Acácias, 100, sala 10, Boqueirão, Santos/SP'],
  ['Av. Dr. Conselheiro Nébias, 754, sala 2010', 'Rua das Acácias, 100, sala 10'],
  ['Rua Pará, 65, conj. 54, Higienópolis, São Paulo/SP', 'Rua das Flores, 250, conj. 5, Higienópolis, São Paulo/SP'],
  ['Rua Pará, 65, conj. 54', 'Rua das Flores, 250, conj. 5'],
  ['Rua Serra de Botucatu, 660, conj. 24/25, Vila Gomes Cardim, São Paulo/SP', 'Rua dos Ipês, 400, conj. 2, Tatuapé, São Paulo/SP'],
  ['Rua Serra de Botucatu, 660, conj. 24/25', 'Rua dos Ipês, 400, conj. 2'],
]

// Telefone de unidade sai inteiro, com a linha: numero inventado pode ser de
// alguem.
const semTelefone = (t) => t.replace(/\n?☎️ *\(\d{2}\) *\d{4,5}-\d{4}/g, '')

function daCentral(valor) {
  if (typeof valor !== 'string') return valor
  let t = valor
  for (const [de, para] of TROCAS) t = t.split(de).join(para)
  return semTelefone(t)
}

// Nada do Dr. Fabio pode sobrar: nome, secretaria, endereco ou telefone.
const PROIBIDO = /F[aá]bio|Pavani|D[aá]rio\b|Dayane|Nébias|Rua Pará|Botucatu|3385|4301|3569|drfabio/i

const q = (v) => (v === null || v === undefined ? 'null' : `'${String(daCentral(v)).replace(/'/g, "''")}'`)
const arr = (lista) => `array[${lista.map(q).join(', ')}]::text[]`
const linhas = []
const sql = (s) => linhas.push(s)

const id = IDENTIDADES.fabio
const t = bancoInicial(id, id.agendaPadrao, FAMILIAS.nova, new Date())

// Os textos de acompanhamento do Dr. Fabio (src/lib/store.ts), com os nomes da
// Central.
const store = readFileSync(new URL('../src/lib/store.ts', import.meta.url), 'utf8')
const modelo = (chave) => store.match(new RegExp(`\\b${chave}: '([^']+)'`))[1]

sql('-- Clinica da Central de teste da ECM (27/10/2026).')
sql('-- Gerado por scripts/clinica-central-sql.mjs a partir dos dados do simulador do')
sql('-- Dr. Fabio, com os nomes do Consultorio Central de Cuidado.')
sql('begin;')
sql('')
sql('do $$')
sql('begin')
sql(`  if exists (select 1 from public.clinics where id = ${q(CLINICA)}) then`)
sql(`    raise exception 'A clinica da Central de teste ja existe - nada alterado.';`)
sql('  end if;')
sql('end')
sql('$$;')
sql('')
sql(`insert into public.clinics (id, name, timezone) values (${q(CLINICA)}, ${q(t.clinics[0].name)}, 'America/Sao_Paulo');`)
sql('')

const pref = id.agendaPadrao.preferencias
const colunas = {
  schedule_slot_minutes: pref.duracao,
  schedule_horizon_days: pref.janela,
  schedule_min_notice_hours: pref.antecedencia,
  whatsapp_autoreply_text: id.textos.saudacao,
  whatsapp_autoreply_known_text: id.textos.saudacaoConhecida,
  whatsapp_menu_info_text: id.textos.informacoes,
  telemedicine_enabled: false,
  telemedicine_info_text: id.telemedicina ?? '',
  template_d15: modelo('d15'),
  template_d30: modelo('d30'),
  template_m90: modelo('m90'),
  whatsapp_profile_about: 'Otorrinolaringologia · Central de teste',
  whatsapp_profile_description:
    'Consultório Central de Cuidado (otorrinolaringologia). Central de teste e de demonstração da ECM Central de Cuidado.',
  // O numero de teste da ECM (Meta, 27/10/2026). Lista de teste vazia = modo
  // teste: os robos agendados so mandam para os celulares que entrarem nela.
  whatsapp_phone_number_id: NUMERO_DE_TESTE_DA_ECM,
}
const nomes = Object.keys(colunas)
const valores = Object.values(colunas).map((v) => (typeof v === 'number' || typeof v === 'boolean' ? String(v) : q(v)))
sql(`insert into public.clinic_settings (clinic_id, ${nomes.join(', ')}, whatsapp_telefones_teste)`)
sql(`values (${q(CLINICA)}, ${valores.join(', ')}, '{}'::text[])`)
sql(`on conflict (clinic_id) do update set ${nomes.map((n) => `${n} = excluded.${n}`).join(', ')}, whatsapp_telefones_teste = excluded.whatsapp_telefones_teste;`)
sql('')

const idDaUnidade = new Map()
for (const u of t.clinic_units) {
  const novo = randomUUID()
  idDaUnidade.set(u.id, novo)
  sql('insert into public.clinic_units (id, clinic_id, name, address, info_text, accepts_insurance, telemedicina, price_cents)')
  sql(
    `values (${q(novo)}, ${q(CLINICA)}, ${q(u.name)}, ${q(u.address)}, ${q(u.info_text)}, ${q(u.accepts_insurance ?? '')}, ${u.telemedicina === true}, ${u.price_cents ?? 'null'});`,
  )
}
sql('')

for (const r of t.availability_rules) {
  sql(
    `insert into public.availability_rules (id, clinic_id, unit_id, weekday, starts_at, ends_at) values (${q(randomUUID())}, ${q(CLINICA)}, ${q(idDaUnidade.get(r.unit_id))}, ${r.weekday}, ${q(r.starts_at)}, ${q(r.ends_at)});`,
  )
}
sql('')

for (const r of id.respostas) {
  sql('insert into public.bot_answers (clinic_id, subject, keywords, answer, ask_unit, hand_off, is_active, position)')
  sql(`values (${q(CLINICA)}, ${q(r.subject)}, ${arr(r.keywords)}, ${q(r.answer)}, ${r.ask_unit === true}, ${r.hand_off === true}, true, ${Number(r.position)});`)
}
sql('')

// Feriados nacionais: a migration de 31/08/2026 so os grava para as clinicas
// que ja existiam.
const FERIADOS = [
  ['2026-11-02', 'Finados'],
  ['2026-11-15', 'Proclamação da República'],
  ['2026-11-20', 'Consciência Negra'],
  ['2026-12-25', 'Natal'],
  ['2027-01-01', 'Confraternização Universal'],
  ['2027-02-08', 'Carnaval (ponto facultativo)'],
  ['2027-02-09', 'Carnaval (ponto facultativo)'],
  ['2027-02-10', 'Quarta-feira de Cinzas (ponto facultativo)'],
  ['2027-03-26', 'Sexta-feira Santa'],
  ['2027-04-21', 'Tiradentes'],
  ['2027-05-01', 'Dia do Trabalho'],
  ['2027-05-27', 'Corpus Christi'],
  ['2027-09-07', 'Independência do Brasil'],
  ['2027-10-12', 'Nossa Senhora Aparecida'],
  ['2027-11-02', 'Finados'],
  ['2027-11-15', 'Proclamação da República'],
  ['2027-11-20', 'Consciência Negra'],
  ['2027-12-25', 'Natal'],
]
sql('insert into public.schedule_exceptions (clinic_id, unit_id, exception_date, is_closed, reason)')
sql(`select ${q(CLINICA)}, null, f.data, true, f.motivo`)
sql('from (values')
sql(FERIADOS.map(([d, m]) => `  (${q(d)}::date, ${q(m)})`).join(',\n'))
sql(') as f(data, motivo);')
sql('')
sql('commit;')
sql('')
sql('-- Conferencia')
sql(
  `select (select name from public.clinics where id = ${q(CLINICA)}) as clinica, (select count(*) from public.clinic_units where clinic_id = ${q(CLINICA)}) as unidades, (select count(*) from public.availability_rules where clinic_id = ${q(CLINICA)}) as horarios, (select count(*) from public.bot_answers where clinic_id = ${q(CLINICA)}) as respostas, (select count(*) from public.schedule_exceptions where clinic_id = ${q(CLINICA)}) as feriados;`,
)

const saida = linhas.join('\n') + '\n'
const sobra = saida.split('\n').filter((l) => PROIBIDO.test(l) && !/^--/.test(l))
if (sobra.length) {
  console.error('Sobrou dado do Dr. Fabio no SQL:\n' + sobra.map((l) => l.slice(0, 160)).join('\n'))
  process.exit(1)
}
process.stdout.write(saida)

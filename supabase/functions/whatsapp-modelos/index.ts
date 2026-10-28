import { corsHeaders, json, userClient } from '../_shared/whatsapp.ts'
import { chaveDoWhatsApp } from '../_shared/whatsapp-teste.ts'
import { motivoDaMeta, resumirModelos, validarModelo, type PedidoDeModelo } from '../_shared/modelo-de-mensagem.ts'

/**
 * Modelos de mensagem do WhatsApp da clinica (28/10/2026).
 *
 * acao 'listar' (padrao): os modelos da conta na Meta, com a situacao de cada
 * um. Qualquer pessoa da clinica ve; e so leitura.
 *
 * acao 'criar': manda um modelo novo para a analise da Meta. So o responsavel
 * pela clinica: o modelo aprovado sai em nome do consultorio, e uma conta com
 * muitos modelos recusados perde qualidade na Meta.
 *
 * A Meta guarda os modelos na conta do WhatsApp (WABA), e nao no numero:
 * por isso a funcao le clinic_settings.whatsapp_waba_id. A chave e a mesma do
 * envio (chaveDoWhatsApp), escolhida pelo numero da clinica.
 */

type Pedido = PedidoDeModelo & { acao?: 'listar' | 'criar' }

const CAMPOS = 'id,name,status,category,language,components,rejected_reason'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const autorizacao = req.headers.get('Authorization') ?? ''
  if (!autorizacao.startsWith('Bearer ')) return json({ error: 'Sessão obrigatória.' }, 401)

  try {
    const escopo = userClient(autorizacao)
    const { data: ajustes } = await escopo
      .from('clinic_settings')
      .select('clinic_id,whatsapp_waba_id,whatsapp_phone_number_id')
      .maybeSingle()

    if (!ajustes?.whatsapp_waba_id || !ajustes?.whatsapp_phone_number_id) {
      return json({ error: 'WhatsApp não configurado para esta clínica.', code: 'SEM_WHATSAPP' }, 409)
    }

    const token = chaveDoWhatsApp(ajustes.whatsapp_phone_number_id)
    if (!token) return json({ error: 'Token do WhatsApp não configurado.' }, 503)

    const versao = Deno.env.get('META_GRAPH_VERSION')?.trim() || 'v25.0'
    const endereco = `https://graph.facebook.com/${versao}/${ajustes.whatsapp_waba_id}/message_templates`
    const corpo = (await req.json().catch(() => ({}))) as Pedido

    if (corpo.acao === 'criar') {
      // A pergunta vai com o cliente do usuario: cada um so enxerga o proprio
      // vinculo (ver _shared/papel.ts).
      const { data: vinculo } = await escopo
        .from('clinic_memberships')
        .select('role')
        .eq('clinic_id', ajustes.clinic_id)
        .eq('status', 'active')
        .eq('role', 'owner')
        .limit(1)
        .maybeSingle()
      if (!vinculo) {
        return json({ error: 'Só o responsável pela clínica cria modelos de mensagem.', code: 'SO_RESPONSAVEL' }, 403)
      }

      const modelo = validarModelo(corpo)
      if (!modelo.ok) return json({ error: modelo.erro, code: 'MODELO_INVALIDO' }, 400)

      const resposta = await fetch(endereco, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(modelo.corpo),
      })
      const dados = await resposta.json().catch(() => null)
      if (!resposta.ok) {
        console.error('A Meta recusou o modelo', dados)
        return json({ error: `A Meta recusou o modelo: ${motivoDaMeta(dados)}`, code: 'META_RECUSOU' }, 502)
      }
      return json({ ok: true, id: dados?.id ?? null, status: dados?.status ?? null })
    }

    const consulta = await fetch(`${endereco}?fields=${CAMPOS}&limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const dados = await consulta.json().catch(() => null)
    if (!consulta.ok) {
      console.error('A Meta recusou a lista de modelos', dados)
      return json({ error: `A Meta recusou a consulta dos modelos: ${motivoDaMeta(dados)}` }, 502)
    }
    return json({ ok: true, modelos: resumirModelos(dados) })
  } catch (causa) {
    console.error('whatsapp-modelos falhou', causa)
    return json({ error: causa instanceof Error ? causa.message : 'Falha inesperada.' }, 500)
  }
})

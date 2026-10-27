# Central de Cuidado: Central de teste da ECM

Cópia do sistema do Dr. Fábio Dario (agenda, prontuário e atendimento pelo
WhatsApp), publicada em 27/10/2026 como a Central de teste e de demonstração da
ECM Central de Cuidado, com o consultório fictício da Dra. Ana Ribeiro.

- Site da ECM: https://centraldecuidado.github.io/ecm-central-de-cuidado/
- Central: https://centraldecuidado.github.io/ecm-central-de-cuidado/sistema/
- Ver o começo do `CLAUDE.md`.

## Atalhos

| Arquivo | O que faz |
| --- | --- |
| `GERAR SIMULADOR.bat` | Testa o robô e gera o simulador em arquivo único |
| `SIMULAR CONVERSAS.bat` | Imprime todas as conversas de demonstração para leitura |
| `TESTAR BOT.bat` | Roda a bateria de testes do robô |
| `PUBLICAR.bat` | Testa, faz o commit e envia para `centraldecuidado/ecm-central-de-cuidado` |

## Desenvolvimento

```bash
npm run dev
```

O simulador fica em `http://localhost:3000/simuladorbot/`. O sistema completo
precisa de um `.env.local` com o Supabase do Dr. Fábio (modelo em
`.env.example`); nunca use a URL ou a chave do Dr. Marcello.

```bash
npm run test:bot
```

```bash
npm run build
```

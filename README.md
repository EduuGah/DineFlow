# DineFlow

Sistema de pedidos para restaurantes. O garçom lança o pedido no celular, a cozinha recebe em tempo real, marca como pronto, e o garçom é avisado na hora.

> **Regra principal do projeto:** primeiro o fluxo principal precisa ser extremamente confiável. Um restaurante tolera um sistema simples — não tolera perder um pedido.

```text
GARÇOM → PEDIDO → COZINHA → PRONTO → GARÇOM → ENTREGA
```

## Tecnologias

| Camada       | Escolha                                         | Por quê                                                                           |
| ------------ | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| Frontend     | Next.js 16 (App Router) + React 19 + TypeScript | Server Components para dados, Client Components para a operação em tempo real     |
| Estilo       | Tailwind CSS 4 + design system próprio          | Tokens semânticos: os mesmos componentes servem celular do garçom e TV da cozinha |
| Banco        | Postgres (Supabase)                             | Isolamento multi-tenant por RLS, no banco e não no frontend                       |
| Autenticação | Supabase Auth                                   | Sessão via cookie, refresh no proxy do Next                                       |
| Tempo real   | Supabase Realtime (`postgres_changes`)          | RLS reaplicado por assinante: um restaurante nunca recebe evento de outro         |
| Testes       | Vitest + PGlite                                 | As migrations de produção rodam num Postgres real, sem Docker                     |

## Como executar

Pré-requisitos: Node 22+ e npm 10+. O Docker é necessário apenas no caminho B (Supabase local).

```bash
npm install
```

Depois escolha um dos dois caminhos para o banco.

### Caminho A — Supabase na nuvem (não exige Docker)

1. Crie um projeto em [supabase.com/dashboard](https://supabase.com/dashboard). Guarde a senha do banco.
2. Em **Project Settings → API**, copie o **Project URL** e a chave **anon / publishable**. Só essas duas — o DineFlow não usa a `service_role`.
3. Preencha o `.env.local` (veja a tabela de variáveis abaixo).
4. Ligue o projeto e aplique as migrations:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref SEU_PROJECT_REF
```

```bash
npm run db:push
```

5. Configure o acesso com Google seguindo [docs/acesso-google.md](docs/acesso-google.md) — são três campos de URL, em três lugares diferentes.

O seed **não** roda neste caminho. Entre em `/entrar` com sua conta Google: como não há convite para o seu e-mail, o sistema oferece cadastrar o restaurante e você vira o administrador. Depois convide a equipe em `Equipe`.

### Caminho B — Supabase local (exige Docker Desktop)

```bash
npx supabase start
```

O comando imprime `API URL`, `anon key` e `service_role key`. Copie para o `.env.local` e aplique schema + dados de desenvolvimento:

```bash
npm run db:reset
```

### Subir a aplicação

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

### Restaurante de demonstração

O seed cria a "Cantina da Esquina" com 12 mesas e cardápio montado, mais convites de exemplo. Para entrar nele, libere o seu e-mail no final de `supabase/seed.sql` (há um bloco comentado pronto) e entre em `/entrar`.

Para ver o fluxo inteiro, abra `/garcom` numa janela e `/cozinha` em outra: o pedido enviado aparece na cozinha sem recarregar, e o "pronto" volta como notificação com som para o garçom.

## Variáveis de ambiente

| Variável                        | Obrigatória | Descrição                                                              |
| ------------------------------- | ----------- | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | sim         | URL da instância Supabase                                              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim         | Chave pública. Segura no browser: toda a proteção vem do RLS           |
| `NEXT_PUBLIC_APP_URL`           | em produção | Endereço público desta instalação; monta o retorno do login com Google |

O DineFlow **não usa** a chave `service_role`. Todo acesso a dados passa pela sessão do usuário e pelo RLS, inclusive o cadastro de equipe — que é por convite, não por criação de credencial.

## Estrutura

```text
src/
├── app/
│   ├── (auth)/          tela de entrada (Google)
│   ├── (app)/           operação: garçom, cozinha, gerente (exige restaurante ativo)
│   ├── (account)/       telas de exceção e painel da plataforma
│   └── auth/callback/   retorno do login com Google
├── components/
│   ├── ui/              design system (Button, Field, Dialog, Badge, ...)
│   ├── waiter/          salão e montagem do pedido
│   ├── kitchen/         KDS
│   ├── manager/         cardápio, mesas, equipe, histórico
│   └── shared/          shell, navegação, notificações, sincronização
├── domain/              regras puras: máquina de estados, permissões, schemas
├── lib/                 clients Supabase, queries, offline, formatação
├── server/actions/      Server Actions (com guarda de permissão própria)
└── types/database.ts    tipos do banco

supabase/migrations/     schema, RLS, triggers e máquina de estados
tests/                   unit (domínio) e integration (Postgres real via PGlite)
docs/                    arquitetura, banco, regras de negócio, manuais
```

## Como testar

```bash
npm run verify
```

Roda type checking, lint e todos os testes. Os 105 testes cobrem: regras puras (máquina de estados, permissões, validação) e integração contra um Postgres real, com as migrations de produção aplicadas. Entre eles:

- isolamento entre restaurantes (um tenant tentando ler e escrever no outro);
- escalonamento de privilégio (garçom tentando virar admin);
- fluxo completo do pedido com os papéis corretos em cada transição;
- idempotência (dois cliques no botão enviar);
- paridade entre a máquina de estados do banco e a do TypeScript;
- vínculo por convite no primeiro login com Google.

Para rodar só uma parte:

```bash
npx vitest run tests/integration/rls.test.ts
```

## Deploy

O projeto roda em qualquer plataforma que suporte Next.js em modo servidor (Vercel, Fly, container próprio).

1. Crie um projeto Supabase de produção.
2. `npx supabase link --project-ref <ref>` e `npm run db:push` para aplicar as migrations.
3. Configure as URLs de OAuth conforme [docs/acesso-google.md](docs/acesso-google.md): Google Cloud Console aponta para o Supabase, e o Supabase aponta para o seu domínio.
4. Defina as variáveis de ambiente na plataforma e refaça o deploy — o Next embute as `NEXT_PUBLIC_` no build.

O workflow em `.github/workflows/ci.yml` roda formatação, lint, types, testes e build a cada pull request.

## Documentação

| Documento                                                | Conteúdo                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| [docs/arquitetura.md](docs/arquitetura.md)               | Como as peças se encaixam e por quê                        |
| [docs/banco-de-dados.md](docs/banco-de-dados.md)         | Tabelas, relacionamentos e triggers                        |
| [docs/regras-de-negocio.md](docs/regras-de-negocio.md)   | Máquina de estados, adicionais, cancelamento, idempotência |
| [docs/acesso-google.md](docs/acesso-google.md)           | Login com Google: URLs no Google, no Supabase e na Vercel  |
|                                                          | Multi-tenancy, permissões, RLS e LGPD                      |
| [docs/realtime-e-offline.md](docs/realtime-e-offline.md) | Eventos, reconexão e fila local                            |
| [docs/manual-garcom.md](docs/manual-garcom.md)           | Manual de operação do salão                                |
| [docs/manual-cozinha.md](docs/manual-cozinha.md)         | Manual da cozinha                                          |
| [docs/manual-gerente.md](docs/manual-gerente.md)         | Manual da gerência                                         |
| [docs/status-do-roadmap.md](docs/status-do-roadmap.md)   | O que já está pronto e o que falta                         |

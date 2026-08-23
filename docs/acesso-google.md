# Acesso com Google — configuração e URLs

O DineFlow não guarda senha. Toda entrada acontece pela conta Google da pessoa, o que remove do restaurante a tarefa de administrar credencial de garçom — e remove do sistema a chave `service_role`, que antes era necessária para criar essas credenciais.

## As três URLs que confundem

Existem três lugares diferentes com campos de URL, e eles apontam para coisas **diferentes**. Errar isso é a causa mais comum de "o login não volta".

```text
1. Google Cloud Console  →  aponta para o SUPABASE
                            https://<ref>.supabase.co/auth/v1/callback

2. Supabase (Redirect)   →  aponta para o SEU APP
                            https://seu-app.vercel.app/auth/callback

3. Vercel (env)          →  diz ao app qual é o endereço dele
                            NEXT_PUBLIC_APP_URL=https://seu-app.vercel.app
```

O fluxo é: seu app → Supabase → Google → Supabase → seu app. O Google só conhece o Supabase; o Supabase é quem conhece o seu app.

## 1. Google Cloud Console

[console.cloud.google.com](https://console.cloud.google.com) → crie ou selecione um projeto.

**APIs e serviços → Tela de permissão OAuth**

- Tipo: Externo
- Nome do app, e-mail de suporte e e-mail do desenvolvedor
- Escopos: `email`, `profile`, `openid` (os padrão bastam)
- Enquanto estiver em "Teste", só os e-mails na lista de usuários de teste conseguem entrar. Para o piloto num restaurante real, publique o app.

**APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**

- Tipo: Aplicativo da Web
- **Origens JavaScript autorizadas:** `https://<PROJECT_REF>.supabase.co`
- **URIs de redirecionamento autorizados:** `https://<PROJECT_REF>.supabase.co/auth/v1/callback`

> Este campo aponta para o **Supabase**, não para o seu app. O `<PROJECT_REF>` é aquele trecho da URL do projeto. O Supabase mostra essa URL pronta para copiar na própria tela do provedor Google.

Guarde o **Client ID** e o **Client Secret**.

## 2. Supabase

**Authentication → Sign In / Providers → Google**

- Ative o provedor
- Cole o Client ID e o Client Secret
- Salve

**Authentication → URL Configuration**

| Campo         | Valor                                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| Site URL      | `https://seu-app.vercel.app` (em desenvolvimento: `http://localhost:3000`)             |
| Redirect URLs | `http://localhost:3000/auth/callback`                                                  |
|               | `https://seu-app.vercel.app/auth/callback`                                             |
|               | `https://*-SEU-TIME.vercel.app/auth/callback` _(opcional, para os deploys de preview)_ |

A URL de retorno do DineFlow é **fixa**, sem query string: `/auth/callback`. O destino final da navegação viaja num cookie, justamente para você não precisar liberar curingas aqui.

## 3. Vercel

**Project Settings → Environment Variables**

| Variável                        | Valor                        | Ambientes                        |
| ------------------------------- | ---------------------------- | -------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://<ref>.supabase.co`  | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anon / publishable     | Production, Preview, Development |
| `NEXT_PUBLIC_APP_URL`           | `https://seu-app.vercel.app` | **Production apenas**            |

Deixe `NEXT_PUBLIC_APP_URL` fora dos ambientes de Preview de propósito: sem ela, o app usa `VERCEL_URL`, que é a URL própria daquele deploy. Fixar o valor de produção no preview faria o login de um preview terminar no site de produção.

Depois de alterar variáveis, **refaça o deploy** — o Next embute as `NEXT_PUBLIC_` no build.

### Domínio próprio

Ao trocar `seu-app.vercel.app` por `dineflow.com.br`, três coisas mudam juntas:

1. Supabase → Site URL e Redirect URLs
2. Vercel → `NEXT_PUBLIC_APP_URL`
3. Nada no Google: aquele campo continua apontando para o Supabase

## Quem entra em qual restaurante

Não existe tela de cadastro. O vínculo é decidido no primeiro login:

```text
pessoa entra com Google
         │
         ├─ existe convite pendente para este e-mail?
         │        └─ sim → entra já vinculada, com o papel do convite
         │
         └─ não → cai em /inicio e pode cadastrar um restaurante novo
                  (vira administrador da própria conta)
```

O gerente convida em **Equipe → Convidar pelo e-mail**. O e-mail precisa ser exatamente o da conta Google que a pessoa usa — o casamento ignora maiúsculas, mas não adivinha endereços alternativos.

Só existe **um convite pendente por e-mail** em toda a plataforma. Dois restaurantes convidando a mesma pessoa criaria ambiguidade justamente no momento em que ninguém está olhando: o primeiro login dela.

## Erros comuns

| Sintoma                                     | Causa provável                                                       |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `redirect_uri_mismatch` no Google           | O URI autorizado no Google não é o do Supabase (`/auth/v1/callback`) |
| Volta para o login sem mensagem             | A URL `/auth/callback` do app não está nas Redirect URLs do Supabase |
| Login funciona local, falha na Vercel       | `NEXT_PUBLIC_APP_URL` errada, ou faltou refazer o deploy             |
| "Acesso bloqueado: app não verificado"      | App OAuth em modo Teste e o e-mail não está na lista de teste        |
| Entra mas cai em "cadastre seu restaurante" | Não há convite pendente para esse e-mail                             |
| `Invalid API key`                           | Chave anon com caractere extra colado (espaço, barra, aspas)         |

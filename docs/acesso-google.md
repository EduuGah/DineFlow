# Acesso ao sistema — dois caminhos

O DineFlow tem duas portas de entrada, e a escolha não é de gosto:

| Quem                     | Como entra                                 | Por quê                                                                                       |
| ------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Dono / administrador     | Conta Google                               | Uma pessoa, uma vez. Sem senha para o sistema guardar                                         |
| Equipe (garçom, cozinha) | Usuário e senha criados pelo administrador | Um garçom não tem conta Google de trabalho, e o restaurante não deveria depender de que tenha |

O administrador cria o acesso em **Equipe → Criar acesso**: nome, e-mail, papel e senha inicial. A conta nasce pronta — basta entregar e-mail e senha. Se a pessoa esquecer a senha no meio do turno, o gerente redefine na hora pelo ícone de chave; não há fluxo por e-mail, que pressuporia o garçom com acesso à caixa de entrada durante o serviço.

Isso exige a chave `SUPABASE_SERVICE_ROLE_KEY` no ambiente — é a única operação do sistema que precisa dela. Sem a chave o app roda normalmente; apenas o cadastro de equipe falha, com mensagem dizendo o que falta.

## Configuração do Google — URLs

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

`NEXT_PUBLIC_APP_URL` precisa ser **exatamente o domínio que aparece na barra do navegador**. O cookie do verificador PKCE é gravado no host da ida e lido no host da volta; se diferirem, o login falha sem erro visível.

Deixe-a fora do Preview de propósito: ali o app usa `VERCEL_URL`, que é o endereço daquele deploy — e é justamente o que você visita num preview. Fixar o valor de produção faria o login de um preview terminar no site de produção.

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

## Diagnóstico

A tela de login mostra uma mensagem curta; o motivo real vai para o log do servidor com o prefixo `[auth]`. No desenvolvimento local ele aparece no terminal do `npm run dev`; na Vercel, em **Deployments → Functions → Logs**.

| Mensagem na tela                         | Código na URL           | O que aconteceu                                                                      |
| ---------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------ |
| "O acesso pela conta Google foi negado"  | `acesso-negado`         | O Google ou o Supabase recusaram; veja o log                                         |
| "O link de retorno era invalido"         | `link-invalido`         | Voltou sem `code` — normalmente configuração de provedor                             |
| "A sessao do login se perdeu no caminho" | `sem-verificador`       | O cookie PKCE não voltou: domínio diferente entre ida e volta, ou cookies bloqueados |
| "Nao foi possivel concluir o login"      | `sessao-invalida`       | A troca do `code` falhou; o log tem o motivo do Supabase                             |
| "O login com Google esta indisponivel"   | `provedor-indisponivel` | Provedor Google desligado ou sem credenciais no Supabase                             |

> Um `code` só pode ser trocado **uma vez**. Recarregar a página de retorno sempre falha — comece o login de novo pela tela de entrada.

## Erros comuns

| Sintoma                                     | Causa provável                                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `redirect_uri_mismatch` no Google           | O URI autorizado no Google não é o do Supabase (`/auth/v1/callback`)                                                                        |
| Volta para o login sem mensagem             | A URL `/auth/callback` do app não está nas Redirect URLs do Supabase                                                                        |
| Login funciona local, falha na Vercel       | `NEXT_PUBLIC_APP_URL` errada, ou faltou refazer o deploy                                                                                    |
| "Acesso bloqueado: app não verificado"      | App OAuth em modo Teste e o e-mail não está na lista de teste                                                                               |
| Entra mas cai em "cadastre seu restaurante" | Não há convite pendente para esse e-mail                                                                                                    |
| `sem-verificador` sempre                    | `NEXT_PUBLIC_APP_URL` aponta para um domínio diferente daquele em que você abriu o site (ida grava o cookie num host, volta procura noutro) |
| `Invalid API key`                           | Chave anon com caractere extra colado (espaço, barra, aspas)                                                                                |

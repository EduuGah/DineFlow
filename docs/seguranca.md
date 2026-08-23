# Segurança

## O princípio

> Um usuário do restaurante A jamais deve conseguir consultar ou modificar dados do restaurante B.

Isso não é responsabilidade do frontend. O frontend é código que roda no aparelho de outra pessoa — ele pode ser modificado, ignorado, ou substituído por um `curl`. A garantia mora no banco.

## Como o tenant é resolvido

```sql
create function app.current_restaurant_id() returns uuid
security definer as $$
  select u.restaurant_id
  from public.users u
  join public.restaurants r on r.id = u.restaurant_id
  where u.id = (select auth.uid())
    and u.status = 'active'
    and r.status in ('trial', 'active')
$$;
```

Três coisas acontecem aqui de uma vez:

1. O restaurante vem da **sessão**, nunca do payload da requisição.
2. Usuário desativado devolve NULL — o acesso morre no mesmo instante, sem precisar revogar o token.
3. Restaurante suspenso devolve NULL — inadimplência bloqueia a operação no banco, não numa checagem de tela.

`SECURITY DEFINER` é necessário: a função lê `public.users`, que tem RLS. Sem isso, a policy de `users` dependeria dela mesma e teríamos recursão infinita.

Existe uma variante `app.current_restaurant_id_unchecked()` usada em um único lugar: a policy de leitura de `restaurants`. Sem ela, um restaurante suspenso mostraria uma tela vazia em vez de explicar o bloqueio.

## Camadas

```text
Autenticado?  →  Pertence ao restaurante?  →  Tem o papel?  →  Dados válidos?
   proxy              RLS                     RLS + trigger      zod + constraints
```

| Camada           | Onde                            | Serve para                                                       |
| ---------------- | ------------------------------- | ---------------------------------------------------------------- |
| Proxy do Next    | `src/proxy.ts`                  | Redirecionar bem. Roda no edge, não vê o banco                   |
| Guarda de página | `requirePermission()`           | Não renderizar tela que o papel não pode usar                    |
| Guarda de action | `assertPermission()`            | Server Action é endpoint HTTP: quem chamar direto passa por aqui |
| RLS              | policies em `..._rls.sql`       | **A garantia.** Nenhum cliente contorna                          |
| Triggers         | `..._orders.sql`, `..._rls.sql` | Regras que RLS não expressa (coluna, transição)                  |

As três primeiras existem para a experiência ser boa. Se sumissem, o sistema continuaria correto.

## O que o RLS não consegue expressar

RLS decide por linha, não por coluna. Três regras precisaram de trigger:

**Escalonamento de privilégio.** A policy `users_update` precisa liberar o self-update (o garçom troca o próprio nome). Sem uma trava, ele trocaria também o próprio `role` para `admin`. O trigger `users_guard_privilege_escalation` recusa mudança de papel, status, restaurante ou e-mail feita por quem não é gerência.

**Cozinha e preço.** A cozinha precisa marcar produto indisponível, mas não pode mexer em preço. `products_guard_kitchen_update` compara o registro inteiro e recusa qualquer alteração fora de `available`.

**Notificação como histórico.** `notifications_guard_update` só deixa `read_at` mudar — ninguém reescreve o texto de um aviso já entregue.

## Superfície anônima

Não existe. A migration de RLS revoga tudo de `anon`:

```sql
revoke all on all tables in schema public from anon;
```

Sem sessão, sem dado. O teste `nao entrega nenhum dado a uma chamada sem sessao` verifica isso tabela por tabela.

## A chave que não existe mais

O DineFlow **não usa** a `service_role`. Ela era necessária para uma única coisa — criar a credencial de um funcionário no Supabase Auth — e o login com Google eliminou esse fluxo: o gerente autoriza um e-mail, e a credencial é a conta Google da pessoa.

O efeito prático é que a chave que ignora todo o RLS não precisa existir no ambiente de produção. Não há como vazar o que não está lá.

O que substituiu esse caminho:

```ts
const session = await assertRestaurantPermission("staff.manage"); // é gerente?
await supabase.from("staff_invitations").insert({
  restaurant_id: session.restaurantId, // vem da SESSÃO, nunca do formulário
  email: parsed.data.email,
  role: parsed.data.role,
});
```

O insert passa pelo RLS como qualquer outro. Se a action fosse chamada diretamente por um garçom, a policy recusaria.

`app_metadata` continua sendo escrito apenas pela `service_role` — por isso o trigger de provisionamento aceita tenant vindo dali, e nunca de `user_metadata`, que o próprio usuário controla.

## Papel no JWT

`users_sync_role_to_auth` espelha papel e tenant no `app_metadata` do token, para o proxy decidir redirecionamentos sem consultar o banco a cada navegação.

Isso é **só para roteamento**. A claim só atualiza no próximo refresh do token (até 1 hora), então nenhuma decisão de acesso a dado depende dela — essas continuam vindo do RLS, que lê a tabela ao vivo. Rebaixar um funcionário tem efeito imediato sobre o que ele consegue ler e escrever; o menu dele pode levar alguns minutos para encolher.

## Testes de segurança

`tests/integration/rls.test.ts` simula um atacante que **já tem sessão válida e o UUID correto do alvo** — exatamente o cenário em que "confiar no frontend" falha:

| Cenário                                          | Resultado esperado                    |
| ------------------------------------------------ | ------------------------------------- |
| Chamada sem sessão                               | Erro de permissão em todas as tabelas |
| Ler pedido de outro restaurante                  | Zero linhas                           |
| Atualizar pedido de outro restaurante            | Nenhuma linha afetada                 |
| Criar pedido em mesa de outro restaurante        | Violação de foreign key               |
| Forjar `restaurant_id` no insert                 | Violação de RLS                       |
| Adicionar produto de outro restaurante ao pedido | `DF003`                               |
| Garçom criando produto ou mesa                   | Violação de RLS                       |
| Garçom se promovendo a admin                     | `DF002`                               |
| Cozinha alterando preço                          | `DF002`                               |
| Restaurante suspenso                             | Zero linhas operacionais              |
| Usuário desativado                               | Zero linhas                           |

Se qualquer um desses passar a devolver dados, o produto não pode ser vendido para dois restaurantes.

## Acesso e sessão

O sistema não guarda senha nenhuma. Detalhes de configuração em [acesso-google.md](acesso-google.md).

- **Sem senha, sem vazamento de senha.** Também some da operação a categoria de problema "esqueci a senha no meio do movimento", e com ela o suporte informal que o gerente acabaria fazendo.
- **PKCE.** O `code` devolvido pelo Google só vale junto com o verificador guardado num cookie do navegador que iniciou o login. Um `code` interceptado não vale nada sozinho.
- **Retorno fixo.** A URL de callback não carrega query string; o destino da navegação viaja num cookie `httpOnly`, `sameSite=lax`, com validade de 10 minutos. Configuração de OAuth com curinga é a fonte mais comum de redirecionamento aberto.
- **Só caminho interno.** O destino é validado contra `//` mesmo vindo de um cookie próprio.
- **Um convite pendente por e-mail** em toda a plataforma: dois restaurantes convidando a mesma pessoa criaria ambiguidade exatamente no primeiro login dela.
- **Rate limit** de autenticação configurado em `supabase/config.toml`.

## LGPD

O sistema coleta o mínimo: nome, e-mail e telefone opcional **de funcionários**. Nenhum dado de cliente final é armazenado — não há cadastro de consumidor, CPF na nota, nem telefone de mesa.

| Exigência          | Como está atendido                                                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Minimizar coleta   | Só nome, e-mail e telefone opcional                                                                                                                                     |
| Finalidade         | Identificar quem executou cada ação na operação                                                                                                                         |
| Controle de acesso | RLS por tenant; auditoria restrita à gerência                                                                                                                           |
| Retenção nos logs  | `app.redact_pii()` remove e-mail, telefone e avatar do metadata de auditoria                                                                                            |
| Exclusão           | Funcionário é desativado, não apagado — o histórico operacional precisa continuar íntegro. Exclusão definitiva com anonimização do histórico ainda não foi implementada |
| Credenciais        | Nunca no código; `.env.local` fora do versionamento                                                                                                                     |

**Pendente:** política de privacidade, termos de uso, e o processo de exportação/exclusão a pedido do titular. As páginas `/termos` e `/privacidade` estão linkadas mas ainda não existem.

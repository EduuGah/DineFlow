# Status do roadmap

Mapa entre o roadmap original e o que existe no código hoje. Escopo desta entrega: **Sprints 01 a 09**.

Legenda: ✅ pronto · 🟡 parcial · ⬜ não iniciado

## Fundação e modelagem

| Seção                                          | Status | Onde                                                                            |
| ---------------------------------------------- | :----: | ------------------------------------------------------------------------------- |
| 1. Definição do produto (usuários, permissões) |   ✅   | `src/domain/permissions.ts`                                                     |
| 2. MVP                                         |   ✅   | Todos os itens da lista entregues                                               |
| 3. Pesquisa com o cliente                      |   ⬜   | Atividade de campo, não de código                                               |
| 4. Regras de negócio                           |   ✅   | [regras-de-negocio.md](regras-de-negocio.md)                                    |
| 5. Arquitetura                                 |   ✅   | [arquitetura.md](arquitetura.md)                                                |
| 6. Multi-tenant                                |   ✅   | RLS + FKs compostas, com testes                                                 |
| 7. Banco de dados                              |   ✅   | `supabase/migrations/`                                                          |
| 8. Segurança do banco                          |   ✅   | `tests/integration/rls.test.ts`                                                 |
| 9. Autenticação e autorização                  |   ✅   | Google OAuth; vínculo por convite. `src/server/actions/auth.ts`, `src/proxy.ts` |

## Operação

| Seção                         | Status | Observação                                                                                  |
| ----------------------------- | :----: | ------------------------------------------------------------------------------------------- |
| 10. Interface do garçom       |   ✅   | Salão, montagem de pedido, busca, observações                                               |
| 11. UX do garçom              |   🟡   | Alvos grandes, estados de erro/vazio/carregamento prontos. Falta testar em campo (seção 43) |
| 12. Tela da cozinha (KDS)     |   ✅   | Três colunas, cronômetro, destaque de atraso                                                |
| 13. Realtime                  |   ✅   | Reconexão, ressincronização, deduplicação                                                   |
| 14. Notificações              |   🟡   | Toast, som, badge e histórico prontos. Web Push é pós-MVP                                   |
| 15. Máquina de estados        |   ✅   | Banco + TypeScript, com teste de paridade                                                   |
| 16. Pedidos adicionais        |   ✅   | Rodadas (`batch`); só a nova vai para a cozinha                                             |
| 17. Cancelamentos             |   ✅   | Motivo obrigatório, notificação, auditoria                                                  |
| 18. Histórico e auditoria     |   ✅   | Append-only, escrito por trigger                                                            |
| 19. Gerenciamento de produtos |   🟡   | CRUD e disponibilidade prontos. Reordenação é por campo numérico, não arrastando            |
| 20. Gerenciamento de mesas    |   🟡   | CRUD e criação em lote. QR Code é pós-MVP                                                   |
| 21. Dashboard do gerente      |   ✅   | Inclui faturamento e ticket médio, que eram "futuro" no roadmap                             |
| 22. Internet instável         |   ✅   | Fila local + idempotência em três camadas                                                   |

## Qualidade

| Seção                    | Status | Observação                                                                                               |
| ------------------------ | :----: | -------------------------------------------------------------------------------------------------------- |
| 23. Performance          |   🟡   | Índices parciais, paginação no histórico. Falta virtualização de listas                                  |
| 24. Segurança            |   🟡   | Autorização, isolamento, validação, rate limit. HTTPS e backup dependem do deploy                        |
| 25. LGPD                 |   🟡   | Coleta mínima e redação de PII nos logs. Faltam os documentos jurídicos e o fluxo de exportação/exclusão |
| 26. Testes               |   🟡   | 105 testes: unitários, integração e segurança. Falta E2E (Playwright)                                    |
| 27. Observabilidade      |   ⬜   | Sem Sentry, sem métricas de uptime, sem alertas                                                          |
| 28. Backup e recuperação |   ⬜   | O Supabase faz backup automático; a restauração nunca foi testada                                        |
| 29. Deploy               |   🟡   | CI com lint, types, testes e build. Faltam ambientes staging/produção                                    |
| 30. Documentação         |   ✅   | Técnica e manuais de operação                                                                            |

## Produto comercial

| Seção                           | Status | Observação                                                            |
| ------------------------------- | :----: | --------------------------------------------------------------------- |
| 31–32. Onboarding               |   🟡   | Checklist de progresso no painel. Falta o wizard passo a passo        |
| 33–34. Planos e assinaturas     |   ⬜   | Sprint 12                                                             |
| 35. Painel da plataforma        |   🟡   | Lista restaurantes e equipe. Métricas de receita dependem de cobrança |
| 36. Design system               |   ✅   | Tokens semânticos e componentes em `src/components/ui/`               |
| 37. UX da cozinha               |   ✅   | Cartões grandes, timer, feedback sonoro                               |
| 38. Estados de erro             |   ✅   | `src/lib/errors.ts` traduz os códigos do banco                        |
| 39. Estados de loading          |   ✅   | Skeleton, botão com loading, feedback pós-ação                        |
| 40. Dados e métricas            |   ✅   | Todos os tempos do roadmap são medidos                                |
| 41–42. Performance real e carga |   ⬜   | Nenhum teste de carga foi executado                                   |
| 43. Piloto com restaurante real |   ⬜   | Próximo passo crítico                                                 |
| 44. Checklist de go-live        |   🟡   | Produto, segurança e UX ok. Infraestrutura e operação pendentes       |
| 45. Roadmap pós-MVP             |   ⬜   | Por definição, depois                                                 |

## Diferenças em relação ao modelo original

Colunas adicionadas ao schema da seção 7, cada uma para atender uma exigência de outra seção:

| Tabela        | Coluna                              | Por quê                                                       |
| ------------- | ----------------------------------- | ------------------------------------------------------------- |
| `orders`      | `number`, `business_date`           | "Pedido #104" precisa ser curto; a sequência reinicia por dia |
| `orders`      | `client_request_id`                 | Idempotência (seção 22)                                       |
| `orders`      | `items_count`, `total`              | Derivados por trigger; evitam recalcular a cada listagem      |
| `orders`      | `received_at`                       | O estado `RECEIVED` existia no roadmap mas não tinha carimbo  |
| `order_items` | `batch`, `status`                   | Pedidos adicionais (seção 16)                                 |
| `order_items` | `product_name`, `total_price`       | Snapshot de preço; comanda antiga não muda com reajuste       |
| `products`    | `available`, `prep_minutes`         | Indisponibilidade (seção 19) e métricas                       |
| `audit_logs`  | `actor_name`, `actor_role`          | Log legível depois de o funcionário sair                      |
| `restaurants` | `timezone`, `trial_ends_at`, `plan` | Dia operacional correto e base para assinatura                |
| `users`       | `status`                            | Desativar sem apagar histórico                                |

Papéis: além de `waiter`, `kitchen`, `manager` e `admin`, existe `platform_admin` — previsto na seção 1.2 do roadmap, mas ausente da lista de `roles` da seção 7.

## O que fazer em seguida

Em ordem de valor, seguindo a lógica do próprio roadmap:

1. **Seção 3 — conversar com o restaurante.** O sistema está pronto para receber correções de fluxo, e é mais barato corrigir agora do que depois de três clientes.
2. **Seção 43 — piloto real.** Acompanhar um dia inteiro de operação. É o único teste que revela o que nenhum unitário revela.
3. **Seção 27 — observabilidade.** Antes de ter cliente pagando, é preciso conseguir descobrir que algo quebrou sem esperar o telefonema.
4. **Seção 28 — testar a restauração do backup.** Ter backup não é o mesmo que conseguir restaurar.
5. **Seção 26 — E2E.** Um Playwright cobrindo o fluxo completo protege as refatorações que virão do piloto.

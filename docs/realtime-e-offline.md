# Tempo real e internet instável

## O problema

Restaurante tem Wi-Fi ruim. Isso não é exceção — é a condição normal de operação. O sistema precisa ser correto nos dois cenários que causam perda de pedido:

1. **A rede cai no meio do envio.** O garçom acha que mandou; a cozinha nunca recebeu.
2. **A rede volta e o cliente reenvia.** O pedido chega duas vezes e a cozinha faz dois pratos.

## Eventos em tempo real

```text
GARÇOM                        BANCO                        COZINHA
  │                             │                             │
  │  update orders.status='sent'│                             │
  ├────────────────────────────►│                             │
  │                             │  postgres_changes           │
  │                             ├────────────────────────────►│
  │                             │                        recarrega a fila
  │                             │                        toca o alerta
  │                             │                             │
  │                             │  update status='ready'      │
  │                             │◄────────────────────────────┤
  │      notificação + som      │                             │
  │◄────────────────────────────┤  (trigger cria notification)│
```

O hook `useRealtime` (`src/hooks/use-realtime.ts`) assina `postgres_changes` nas tabelas relevantes, filtrado por `restaurant_id`. O Supabase Realtime **reaplica o RLS por assinante**: mesmo um canal sem filtro só entregaria linhas do próprio restaurante. O filtro existe para economizar tráfego, não para isolar.

## Reconexão e ressincronização

O cliente do Supabase reconecta sozinho com backoff. O que ele **não** faz é entregar os eventos perdidos durante a queda — e é aí que um KDS ingênuo mostra uma fila desatualizada a noite inteira.

Por isso `useRealtime` expõe `onSync`, chamado a cada `SUBSCRIBED`, inclusive na primeira conexão:

```ts
useRealtime({
  restaurantId,
  tables: ["orders", "order_items"],
  onEvent: reload, // mudou algo → recarrega
  onSync: reload, // (re)conectou → recarrega tudo
});
```

Recarregar o estado inteiro é mais barato do que parece (a fila da cozinha tem dezenas de linhas) e é a única forma de não depender de eventos que podem não ter chegado.

O salão do garçom recarrega também no `visibilitychange`: em celular o socket costuma cair enquanto a tela está apagada.

## Eventos duplicados

Depois de uma reconexão, o servidor pode reentregar eventos. A chave de deduplicação junta tabela, tipo de evento, id da linha e versão:

```ts
`${payload.table}:${payload.eventType}:${record.id}:${record.updated_at}`;
```

Incluir `updated_at` importa: um UPDATE legítimo logo depois de outro tem versão diferente e **não** é confundido com repetição. A janela guarda as últimas 200 chaves.

No KDS há uma segunda proteção, dessa vez sobre o som: o alerta só toca para comanda que a cozinha ainda não viu (`knownIds`). Um KDS que apita a cada reconexão é um KDS com o som desligado no fim da primeira noite.

## Fila local (outbox)

`src/lib/offline/outbox.ts` guarda as operações do salão em `localStorage`.

```text
ação do garçom
     │
     ├─ fila vazia? → tenta enviar direto
     │                    │
     │                    ├─ sucesso → pronto
     │                    ├─ erro de rede → entra na fila
     │                    └─ erro do banco → mostra na hora
     │
     └─ fila com itens? → entra na fila (mantém a ordem)
```

Quando a conexão volta, `SyncIndicator` dispara o `flushOutbox()`.

### Por que a ordem importa

A fila é processada **em série** e para na primeira falha de rede. Reenviar as operações seguintes fora de ordem criaria item em pedido que ainda não existe.

### Erro de rede x erro do banco

| Tipo       | Exemplo                                                | O que a fila faz                     |
| ---------- | ------------------------------------------------------ | ------------------------------------ |
| Transiente | `Failed to fetch`, timeout                             | Mantém e tenta de novo (até 8 vezes) |
| Definitivo | Produto indisponível, pedido já fechado, sem permissão | Descarta e mostra o motivo           |

Insistir para sempre num pedido que o banco recusa não conserta nada — só esconde o problema do garçom.

### O que não entra na fila

Cancelamento. Ele precisa de confirmação do servidor agora: cancelar "no escuro" um prato que já foi feito é pior do que avisar o garçom que a rede caiu.

## Idempotência

Cada operação carrega um id gerado no aparelho e usado como chave primária da linha. Reenviar colide com a linha existente (`23505`), e a fila trata isso como "já aplicada".

No caso do pedido, há uma segunda chave: `client_request_id`, com índice único por restaurante. É a que garante que dois cliques no botão "Enviar" produzam **um** pedido, mesmo que o primeiro clique tenha chegado ao servidor e a resposta se perdido no caminho.

O teste `rejeita o segundo envio quando o garcom clica duas vezes` cobre exatamente esse contrato no banco.

## O que o usuário vê

| Situação               | Interface                                          |
| ---------------------- | -------------------------------------------------- |
| Tudo sincronizado      | Nada. Indicador verde permanente vira ruído        |
| Sem conexão            | Faixa vermelha com o número de operações pendentes |
| Reconectando, com fila | Faixa amarela "Enviando N..."                      |
| Fila enviada           | Toast confirmando quantas operações saíram         |
| Operação recusada      | Toast de erro com o motivo em português            |
| Canal do KDS caído     | "Reconectando..." no cabeçalho da cozinha          |

## Limites conhecidos

- `navigator.onLine` só sabe se existe interface de rede. Num restaurante, o Wi-Fi costuma continuar "conectado" enquanto o link não entrega nada. O sinal confiável é o canal de realtime; `useOnline` cobre apenas o caso óbvio (celular saiu do alcance).
- A fila vive em `localStorage`, ou seja, é por aparelho e por navegador. Se o garçom trocar de celular com a fila cheia, as operações pendentes ficam no aparelho antigo.
- Não há Service Worker: a aplicação em si precisa estar carregada. Um PWA com cache de shell é evolução natural, mas não estava no MVP.

# Manual da cozinha

## A tela

A tela da cozinha é feita para ser olhada de longe, com a mão ocupada. Funciona melhor num tablet ou numa TV fixa. Deixe aberta o dia inteiro — ela se atualiza sozinha.

São três colunas:

```text
NOVOS            EM PREPARO           PRONTOS
(chegaram)       (fazendo)            (aguardando o garçom)
```

Em cada coluna, **o mais antigo fica no topo**. Quem esperou mais sai primeiro.

## O cartão do pedido

```text
#104                                    12min
Mesa 12
─────────────────────────────
2x  Hambúrguer artesanal
    Sem cebola
1x  Batata frita
─────────────────────────────
João Pereira        [Iniciar preparo]
```

- O **número grande** é o pedido; abaixo dele, a mesa.
- O **cronômetro** no canto conta desde que o pedido chegou.
- As **observações** aparecem em amarelo. Elas são a diferença entre prato aceito e prato devolvido.

## Cores e tempo

| Borda             | Significado                                         |
| ----------------- | --------------------------------------------------- |
| Normal            | Dentro do tempo                                     |
| Amarela           | Passou de 8 minutos                                 |
| Vermelha piscando | Passou de 15 minutos — alguém está esperando demais |

No alto da tela aparece o total de pedidos atrasados.

## Trabalhar

Cada cartão tem **um botão grande** com a ação óbvia:

1. Pedido chegou, toque em **Iniciar preparo** — vai para "Em preparo".
2. Prato pronto, toque em **Marcar pronto** — vai para "Prontos" e avisa o garçom na hora.

Marcou pronto sem querer? Abra as ações do cartão e escolha **Em preparo** para reabrir.

## Adicionais

Quando aparece a etiqueta **"Tem adicional"**, o cliente pediu mais coisa depois. Dentro do cartão, uma linha tracejada separa o que já foi feito do que falta:

```text
2x  Hambúrguer          já feito
─ ─ ADICIONAL ─ ─
1x  Refrigerante        faltando
```

Faça só o que está abaixo da linha.

## Produto acabou

Não espere o pedido chegar para descobrir. Assim que um ingrediente acabar, marque o produto como indisponível — o garçom deixa de conseguir lançá-lo.

A cozinha pode alterar a disponibilidade de qualquer produto. Preço e cadastro continuam com a gerência.

## Cancelar

A cozinha pode cancelar um pedido que já começou, tipicamente quando o produto acabou no meio do preparo. O motivo é obrigatório e o garçom é avisado na hora.

## Som

O aviso sonoro toca quando chega comanda nova. Ele só funciona depois do primeiro toque na tela (regra do navegador) — encoste na tela ao abrir, no começo do turno.

Para ligar ou desligar, use o sino no alto da tela.

## Se aparecer "Reconectando..."

A tela perdeu contato com o servidor e está tentando voltar sozinha. Assim que reconectar, a fila é recarregada inteira — nenhum pedido se perde. Se ficar muito tempo assim, verifique o Wi-Fi.

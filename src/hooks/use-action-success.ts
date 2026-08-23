"use client";

import { useEffect, useRef } from "react";
import type { ActionResult } from "@/lib/errors";

/**
 * Dispara um efeito UMA vez por submissao bem-sucedida.
 *
 * O padrao ingenuo -- `useEffect(() => { if (state?.ok) { toast(); onClose(); } },
 * [state, onClose, router])` -- reexecuta a cada render, porque `onClose` e
 * `router` mudam de identidade toda vez. Com o estado permanecendo `ok`, o
 * resultado e o toast disparando em loop.
 *
 * Aqui a submissao já tratada fica guardada numa ref. `useActionState` devolve
 * um objeto NOVO a cada submissao, então comparar identidade basta para
 * distinguir "outra submissao deu certo" de "a mesma, renderizada de novo".
 */
export function useActionSuccess<T>(state: ActionResult<T> | null, onSuccess: (data: T) => void) {
  const handled = useRef<ActionResult<T> | null>(null);
  const callback = useRef(onSuccess);

  useEffect(() => {
    callback.current = onSuccess;
  });

  useEffect(() => {
    if (!state?.ok || handled.current === state) return;

    handled.current = state;
    callback.current(state.data);
  }, [state]);
}

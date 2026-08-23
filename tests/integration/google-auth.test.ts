import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  createTestDb,
  seedRestaurant,
  type SeededRestaurant,
  type TestDb,
} from "../support/pglite";

/**
 * Acesso via Google.
 *
 * Sem formulario de cadastro, o vinculo entre pessoa e restaurante acontece em
 * dois momentos que precisam ser exatos: o convite casando pelo e-mail no
 * primeiro login, e a criacao do restaurante pelo dono. Errar aqui significa
 * alguem entrar no restaurante errado -- ou nao conseguir entrar em nenhum.
 */

/** Simula o que o Supabase grava quando alguem entra com o Google. */
async function signInWithGoogle(db: TestDb, email: string, fullName: string) {
  const [user] = await db.sql<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data, raw_app_meta_data)
     values (
       $1,
       jsonb_build_object(
         'full_name', $2::text,
         'avatar_url', 'https://lh3.googleusercontent.com/foto',
         'email_verified', true
       ),
       jsonb_build_object('provider', 'google', 'providers', jsonb_build_array('google'))
     )
     returning id`,
    [email, fullName],
  );

  return user.id;
}

describe("convite de equipe", () => {
  let db: TestDb;
  let seed: SeededRestaurant;

  beforeAll(async () => {
    db = await createTestDb();
    seed = await seedRestaurant(db, "Restaurante Convite");
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it("vincula a pessoa ao restaurante no primeiro login", async () => {
    await db.asUser(seed.users.manager, (session) =>
      session.sql(
        `insert into public.staff_invitations (restaurant_id, email, role, invited_by)
         values ($1, $2, 'kitchen', $3)`,
        [seed.restaurantId, "novo.cozinheiro@gmail.com", seed.users.manager],
      ),
    );

    const userId = await signInWithGoogle(db, "novo.cozinheiro@gmail.com", "Carlos Lima");

    const [profile] = await db.sql<{
      restaurant_id: string;
      role: string;
      name: string;
      avatar_url: string | null;
    }>(`select restaurant_id, role, name, avatar_url from public.users where id = $1`, [userId]);

    expect(profile.restaurant_id).toBe(seed.restaurantId);
    expect(profile.role).toBe("kitchen");
    // O nome vem do Google (full_name), nao do trecho antes do @.
    expect(profile.name).toBe("Carlos Lima");
    expect(profile.avatar_url).toContain("googleusercontent.com");
  });

  it("marca o convite como aceito, para nao valer duas vezes", async () => {
    const [invitation] = await db.sql<{ accepted_at: string | null; accepted_by: string | null }>(
      `select accepted_at, accepted_by from public.staff_invitations
       where lower(email) = 'novo.cozinheiro@gmail.com'`,
    );

    expect(invitation.accepted_at).not.toBeNull();
    expect(invitation.accepted_by).not.toBeNull();
  });

  it("casa o e-mail sem diferenciar maiusculas", async () => {
    await db.asUser(seed.users.manager, (session) =>
      session.sql(
        `insert into public.staff_invitations (restaurant_id, email, role)
         values ($1, 'Maria.Alves@Gmail.com', 'waiter')`,
        [seed.restaurantId],
      ),
    );

    const userId = await signInWithGoogle(db, "maria.alves@gmail.com", "Maria Alves");

    const [profile] = await db.sql<{ role: string }>(
      `select role from public.users where id = $1`,
      [userId],
    );

    expect(profile.role).toBe("waiter");
  });

  it("deixa sem perfil quem entra sem convite", async () => {
    const userId = await signInWithGoogle(db, "desconhecido@gmail.com", "Pessoa Qualquer");

    const rows = await db.sql(`select id from public.users where id = $1`, [userId]);

    // Sem perfil, a aplicacao leva para a tela de criar restaurante em vez de
    // adivinhar a que casa a pessoa pertence.
    expect(rows).toEqual([]);
  });

  it("recusa dois convites pendentes para o mesmo e-mail", async () => {
    const outro = await seedRestaurant(db, "Restaurante Rival");

    await db.asUser(outro.users.manager, (session) =>
      session.sql(
        `insert into public.staff_invitations (restaurant_id, email, role)
         values ($1, 'disputado@gmail.com', 'waiter')`,
        [outro.restaurantId],
      ),
    );

    await expect(
      db.asUser(seed.users.manager, (session) =>
        session.sql(
          `insert into public.staff_invitations (restaurant_id, email, role)
           values ($1, 'disputado@gmail.com', 'waiter')`,
          [seed.restaurantId],
        ),
      ),
    ).rejects.toThrow(/duplicate key|staff_invitations_pending_email_key/i);
  });

  it("impede o garcom de convidar ou de ler convites", async () => {
    await expect(
      db.asUser(seed.users.waiter, (session) =>
        session.sql(
          `insert into public.staff_invitations (restaurant_id, email, role)
           values ($1, 'amigo@gmail.com', 'manager')`,
          [seed.restaurantId],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);

    const visiveis = await db.asUser(seed.users.waiter, (session) =>
      session.sql(`select id from public.staff_invitations`),
    );
    expect(visiveis).toEqual([]);
  });

  it("esconde os convites de outro restaurante", async () => {
    const outro = await seedRestaurant(db, "Restaurante Isolado");

    await db.asUser(outro.users.manager, (session) =>
      session.sql(
        `insert into public.staff_invitations (restaurant_id, email, role)
         values ($1, 'privado@gmail.com', 'waiter')`,
        [outro.restaurantId],
      ),
    );

    const vistos = await db.asUser(seed.users.manager, (session) =>
      session.sql<{ email: string }>(`select email from public.staff_invitations`),
    );

    expect(vistos.map((row) => row.email)).not.toContain("privado@gmail.com");
  });
});

describe("cadastro do restaurante pelo dono", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it("cria restaurante e perfil de administrador de uma vez", async () => {
    const userId = await signInWithGoogle(db, "dona@gmail.com", "Ana Ribeiro");

    const [created] = await db.asUser(userId, (session) =>
      session.sql<{ id: string }>(`select public.create_restaurant('Cantina da Ana') as id`),
    );

    const [profile] = await db.sql<{ restaurant_id: string; role: string; name: string }>(
      `select restaurant_id, role, name from public.users where id = $1`,
      [userId],
    );

    expect(profile.restaurant_id).toBe(created.id);
    expect(profile.role).toBe("admin");
    expect(profile.name).toBe("Ana Ribeiro");

    const [restaurant] = await db.sql<{ slug: string; status: string; trial_ends_at: string }>(
      `select slug, status, trial_ends_at from public.restaurants where id = $1`,
      [created.id],
    );

    expect(restaurant.slug).toBe("cantina-da-ana");
    expect(restaurant.status).toBe("trial");
    expect(restaurant.trial_ends_at).not.toBeNull();
  });

  it("recusa quem ja tem restaurante", async () => {
    const [user] = await db.sql<{ id: string }>(
      `select id from public.users where email = 'dona@gmail.com'`,
    );

    await expect(
      db.asUser(user.id, (session) =>
        session.sql(`select public.create_restaurant('Segunda Casa')`),
      ),
    ).rejects.toThrow(/DF006|ja esta vinculada/);
  });

  it("recusa nome vazio", async () => {
    const userId = await signInWithGoogle(db, "outro.dono@gmail.com", "Beto");

    await expect(
      db.asUser(userId, (session) => session.sql(`select public.create_restaurant('  ')`)),
    ).rejects.toThrow(/DF007|Informe o nome/);
  });

  it("recusa chamada sem sessao", async () => {
    await expect(
      db.asAnon((session) => session.sql(`select public.create_restaurant('Invasora')`)),
    ).rejects.toThrow(/permission|DF002/i);
  });
});

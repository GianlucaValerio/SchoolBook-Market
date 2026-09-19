-- ============================================================
-- LibroScambio — Schema Supabase
-- Esegui in ordine nel SQL Editor di Supabase
-- ============================================================

-- -------------------------------------------------------
-- 1. SCUOLE (da MIM anagrafica)
-- -------------------------------------------------------
create table if not exists schools (
  codice_istituto   text primary key,
  nome              text not null,
  indirizzo         text,
  cap               text,
  codice_comune     text,
  comune            text,
  provincia         text,
  regione           text,
  tipo_codice       text,
  tipo              text,
  email             text,
  pec               text,
  sito              text,
  updated_at        timestamptz default now()
);

create index if not exists idx_schools_comune on schools(comune);
create index if not exists idx_schools_provincia on schools(provincia);
create index if not exists idx_schools_nome on schools using gin(to_tsvector('italian', nome));

-- -------------------------------------------------------
-- 2. ADOZIONI (da MIM per regione)
-- -------------------------------------------------------
create table if not exists adoptions (
  id                bigserial primary key,
  codice_istituto   text references schools(codice_istituto),
  anno_scolastico   text not null,  -- es. "2026/27"
  anno_classe       text,           -- es. "3"
  sezione           text,
  isbn              text,
  titolo            text,
  autore            text,
  editore           text,
  prezzo            numeric(8,2),
  da_acquistare     text,
  da_utilizzare     text,
  consigliato       text,
  regione           text,
  updated_at        timestamptz default now(),
  unique (codice_istituto, isbn, anno_classe, anno_scolastico)
);

create index if not exists idx_adoptions_isbn on adoptions(isbn);
create index if not exists idx_adoptions_scuola on adoptions(codice_istituto);
create index if not exists idx_adoptions_anno on adoptions(anno_scolastico);
create index if not exists idx_adoptions_titolo on adoptions using gin(to_tsvector('italian', coalesce(titolo,'')));

-- -------------------------------------------------------
-- 3. UTENTI (estende auth.users di Supabase)
-- -------------------------------------------------------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text,
  cognome     text,
  telefono    text,
  citta       text,
  cap         text,
  avatar_url  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Trigger per creare il profilo automaticamente al signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- -------------------------------------------------------
-- 4. FIGLI registrati dagli utenti
-- -------------------------------------------------------
create table if not exists children (
  id                bigserial primary key,
  user_id           uuid references profiles(id) on delete cascade,
  nome              text not null,
  codice_istituto   text references schools(codice_istituto),
  anno_classe       int not null,   -- 1-5
  sezione           text,
  anno_scolastico   text not null,  -- es. "2026/27"
  created_at        timestamptz default now()
);

create index if not exists idx_children_user on children(user_id);
create index if not exists idx_children_scuola on children(codice_istituto, anno_classe);

-- -------------------------------------------------------
-- 5. ANNUNCI di vendita
-- -------------------------------------------------------
create table if not exists listings (
  id              bigserial primary key,
  user_id         uuid references profiles(id) on delete cascade,
  isbn            text not null,
  titolo          text,             -- denormalizzato per velocità
  editore         text,
  prezzo          numeric(8,2),
  prezzo_nuovo    numeric(8,2),     -- prezzo ufficiale MIM per confronto
  condizione      text check (condizione in ('ottimo','buono','discreto','usato')),
  note            text,
  immagine_url    text,
  stato           text default 'disponibile' check (stato in ('disponibile','riservato','venduto')),
  citta           text,
  cap             text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_listings_isbn on listings(isbn);
create index if not exists idx_listings_stato on listings(stato);
create index if not exists idx_listings_user on listings(user_id);

-- -------------------------------------------------------
-- 6. VIEW: match potenziali venditori
--    Dato un ISBN e una scuola, trova utenti che avevano
--    quel libro l'anno precedente (classe - 1)
-- -------------------------------------------------------
create or replace view potential_sellers as
select
  l.isbn,
  l.anno_scolastico                          as anno_adozione,
  l.codice_istituto,
  l.anno_classe::int                         as anno_classe_adozione,
  (l.anno_classe::int + 1)                   as anno_classe_attuale,
  -- Anno scolastico "attuale" derivato
  ( split_part(l.anno_scolastico,'/',1)::int + 1 )
  || '/' ||
  right( (split_part(l.anno_scolastico,'/',2)::int + 1)::text, 2)
                                             as anno_scolastico_attuale,
  c.user_id,
  p.nome,
  p.cognome,
  p.citta,
  p.cap,
  s.nome                                     as nome_scuola,
  s.comune,
  s.provincia
from adoptions l
join children c
  on  c.codice_istituto = l.codice_istituto
  and c.anno_classe     = (l.anno_classe::int + 1)
join profiles p on p.id = c.user_id
join schools  s on s.codice_istituto = l.codice_istituto
where l.isbn is not null;

-- -------------------------------------------------------
-- 7. ROW LEVEL SECURITY
-- -------------------------------------------------------
alter table profiles  enable row level security;
alter table children  enable row level security;
alter table listings  enable row level security;

-- Profili: ognuno vede solo il proprio
create policy "profilo personale" on profiles
  for all using (auth.uid() = id);

-- Figli: ognuno gestisce i propri
create policy "figli personali" on children
  for all using (auth.uid() = user_id);

-- Annunci: tutti vedono quelli disponibili, ognuno gestisce i propri
create policy "leggi annunci" on listings
  for select using (stato = 'disponibile');

create policy "gestisci annunci" on listings
  for all using (auth.uid() = user_id);

-- Schools e adoptions: lettura pubblica
alter table schools   enable row level security;
alter table adoptions enable row level security;

create policy "leggi scuole"   on schools   for select using (true);
create policy "leggi adozioni" on adoptions for select using (true);

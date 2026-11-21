// One-time staging-only test. Uses normal GoTrue email/password signup,
// never admin/service keys. All test accounts are tagged for SQL cleanup.
// Do NOT run against production. No credentials or JWTs are logged.
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const URL = 'https://isjzyyoqvftrltkctanw.supabase.co';
const TAG = 'study-pro-pr562-authenticated-e2e-20261121';
if (process.env.STUDY_PRO_AUTH_QA_ENABLED !== 'true' ||
    process.env.VITE_SUPABASE_URL !== URL ||
    !process.env.VITE_SUPABASE_ANON_KEY?.startsWith('sb_publishable_')) {
  throw new Error('Live authenticated QA is disabled or not isolated to staging');
}
const key = process.env.VITE_SUPABASE_ANON_KEY;
const makeClient = () => createClient(URL, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const clientA = makeClient();
const clientB = makeClient();
// Only send confirmation mail to a QA inbox owned and configured by the
// operator; never make up random recipients on third-party email domains.
const makeCredentials = () => {
  const inbox = process.env.STUDY_PRO_QA_OWNED_INBOX ?? '';
  const match = inbox.match(/^([^@+\\s]+)@([^@\\s]+\\.[^@\\s]+)$/);
  if (!match) {
    throw new Error('A dedicated, user-controlled QA email inbox must be configured');
  }
  const id = randomBytes(12).toString('hex');
  return {
    email: `${match[1]}+pr562-${id}@${match[2]}`,
    password: randomBytes(32).toString('base64url'),
  };
};
const signup = async (client, kind) => {
  const credentials = makeCredentials();
  const { data, error } = await client.auth.signUp({
    ...credentials, options: { data: { study_pro_qa_tag: TAG, qa_role: kind } },
  });
  if (error) {
    console.log(`AUTH_SIGNUP_BLOCKED_${kind}:`, error.code ?? error.status ?? 'unknown');
    return { ok: false, error: error.code ?? 'signup-failed' };
  }
  if (data.user?.id) {
    // The account is disposable and identified by its exact QA metadata tag.
    console.log(`AUTH_QA_USER_CREATED_${kind}:`, data.user.id);
  }
  if (!data.session?.access_token) {
    console.log(`AUTH_CONFIRMATION_REQUIRED_${kind}: GoTrue did not return a session`);
    return { ok: false, error: 'confirmation-required' };
  }
  return { ok: true, credentials, user: data.user, session: data.session, client };
};
const expectRpc = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.code ?? result.error.message}`);
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!row || typeof row.ok !== 'boolean') throw new Error(`${label}: unexpected RPC shape`);
  return row;
};
function state(revision, ids, tag) {
  const at = new Date().toISOString();
  return {
    schemaVersion: 18, versao: 18, syncRevision: revision,
    materias: [], questoes: [], revisoes: [], simulados: [],
    bancoQuestoes: [], simuladosGerados: [], missoesConcluidas: [],
    sessoes: ids.map(id => ({
      id, tipo: 'estudo', data: at.slice(0, 10), materia: 'QA Staging',
      assunto: 'CAS', minutos: 5,
    })),
    configuracoes: {
      nomeUsuario: 'Conta isolada de QA', concurso: 'QA', bancaPadrao: '',
      metaQuestoesDiaria: 10, metaMinutosDiaria: 20, metaRevisoesDiaria: 2,
      missoesPorDia: 1, tema: 'escuro', armazenamentoPorConta: true,
    },
    salvoEm: at, atualizadoEm: at,
  };
}
async function main() {
  const a = await signup(clientA, 'A');
  if (!a.ok) return;
  const b = await signup(clientB, 'B');
  if (!b.ok) return;
  assert.notEqual(a.user.id, b.user.id, 'must use two independent user accounts');

  // Log in twice with the same account to create two independent GoTrue
  // sessions (the same real end-user on PC and phone).
  const pc = makeClient();
  const phone = makeClient();
  const [pcAuth, phoneAuth] = await Promise.all([
    pc.auth.signInWithPassword(a.credentials),
    phone.auth.signInWithPassword(a.credentials),
  ]);
  if (pcAuth.error || phoneAuth.error ||
      !pcAuth.data.session || !phoneAuth.data.session)
    throw new Error('Real email/password dual-session login failed');
  assert.notEqual(pcAuth.data.session.access_token, phoneAuth.data.session.access_token);
  console.log('AUTH_TWO_SESSIONS: PASS');

  let first = state(1, ['qa-old'], 'initial');
  let stored = expectRpc(await pc.rpc('salvar_estado_app_cas', {
    p_expected_revision: 0, p_estado: first,
  }), 'initial CAS');
  assert.equal(stored.ok, true);
  assert.equal(stored.revisao_atual, 1);
  console.log('CAS_INITIAL: PASS');

  const [pcWrite, phoneWrite] = await Promise.all([
    pc.rpc('salvar_estado_app_cas', {
      p_expected_revision: 1, p_estado: state(2, ['qa-old','qa-pc'], 'pc'),
    }),
    phone.rpc('salvar_estado_app_cas', {
      p_expected_revision: 1, p_estado: state(2, ['qa-old','qa-phone'], 'phone'),
    }),
  ]);
  const [winPC, winPhone] = [expectRpc(pcWrite, 'pc CAS'),expectRpc(phoneWrite,'phone CAS')];
  assert.equal([winPC.ok, winPhone.ok].filter(Boolean).length, 1);
  console.log('CAS_REAL_CONCURRENT_SESSIONS: PASS');

  // Cross-account read is forbidden even with valid real GoTrue credentials.
  const { data: otherRead, error: otherError } = await clientB.from('configuracoes')
    .select('user_id').eq('user_id', a.user.id);
  if (otherError) throw new Error(`Cross-account read: ${otherError.code}`);
  assert.equal(otherRead?.length ?? 0, 0);
  console.log('RLS_ISOLATION: PASS');

  const { data: checkpoint, error: backupError } = await pc.from('backups').insert({
    user_id: a.user.id,
    nome: `pr562 qa history ${randomBytes(4).toString('hex')}`,
    versao: 18,
    dados: { tipo: 'backup_incremental', estado: first,
      criadoEm: new Date().toISOString(), syncRevision: 1 },
  }).select('id').single();
  if (backupError || !checkpoint?.id)
    throw new Error(`Backup creation failed: ${backupError?.code ?? 'unknown'}`);

  const otherBackup = await clientB.from('backups').select('id').eq('id',checkpoint.id);
  if (otherBackup.error) throw new Error(`Backup isolation: ${otherBackup.error.code}`);
  assert.equal(otherBackup.data?.length ?? 0, 0);

  const restored = expectRpc(await pc.rpc('restaurar_backup_cas', {
    p_backup_id: checkpoint.id, p_expected_revision: 2,
    p_confirmacao: 'CONFIRMO_RESTAURACAO',
  }), 'restore CAS');
  assert.equal(restored.ok, true);
  assert.equal(restored.revisao_atual, 3);
  assert.ok(restored.backup_seguranca_id);
  const { data: preRestore, error: safetyError } = await pc.from('backups')
    .select('id,dados').eq('id',restored.backup_seguranca_id).single();
  if (safetyError) throw new Error(`Safety copy read: ${safetyError.code}`);
  assert.equal(preRestore?.dados?.estado?.sessoes?.length, 2);
  console.log('BACKUP_ATOMIC_RESTORE_AND_SAFETY: PASS');

  // The stale phone must not be able to undo the completed restore.
  const stale = expectRpc(await phone.rpc('salvar_estado_app_cas', {
    p_expected_revision: 2, p_estado: state(3, ['qa-old','qa-phone'], 'stale'),
  }), 'stale phone CAS');
  assert.equal(stale.ok, false);
  assert.equal(stale.revisao_atual, 3);
  console.log('CAS_STALE_AFTER_RESTORE: PASS');
  console.log('STAGING_LIVE_AUTH_END_TO_END_PASS');
}
main().catch(error => {
  console.error('STAGING_LIVE_AUTH_ERROR:', error.message);
  process.exitCode = 1;
}).finally(async () => {
  await Promise.allSettled([
    clientA.auth.signOut(), clientB.auth.signOut(),
  ]);
  console.log('QA_CLEANUP_SQL_REQUIRED_FOR_TAG:', TAG);
});

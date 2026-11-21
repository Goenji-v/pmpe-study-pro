// Manual staging-only GoTrue test with PRE-EXISTING, admin-confirmed QA users.
// NO account signup, SMTP, service_role keys or changes to production.
// Credentials must come from private environment variables, never the repo.
// The operator must verify/delete QA rows after the run.
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const URL = 'https://isjzyyoqvftrltkctanw.supabase.co';
if (process.env.STUDY_PRO_AUTH_QA_ENABLED !== 'true' ||
    process.env.VITE_SUPABASE_URL !== URL ||
    !process.env.VITE_SUPABASE_ANON_KEY?.startsWith('sb_publishable_')) {
  throw new Error('Live QA is disabled or not isolated to staging');
}
const secrets = [
  'STUDY_PRO_QA_EMAIL_A',
  'STUDY_PRO_QA_PASSWORD_A',
  'STUDY_PRO_QA_EMAIL_B',
  'STUDY_PRO_QA_PASSWORD_B',
];
if (secrets.some(name => !process.env[name])) {
  throw new Error('Dedicated, admin-confirmed QA credentials must be configured privately');
}
const credentialsA = {
  email: process.env.STUDY_PRO_QA_EMAIL_A,
  password: process.env.STUDY_PRO_QA_PASSWORD_A,
};
const credentialsB = {
  email: process.env.STUDY_PRO_QA_EMAIL_B,
  password: process.env.STUDY_PRO_QA_PASSWORD_B,
};
if (credentialsA.email === credentialsB.email) {
  throw new Error('Separate account B is required for cross-user RLS QA');
}
const key = process.env.VITE_SUPABASE_ANON_KEY;
const makeClient = () => createClient(URL, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const clientA = makeClient();
const clientB = makeClient();
const liveClients = [clientA,clientB];
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
  const [loginA, loginB] = await Promise.all([
    clientA.auth.signInWithPassword(credentialsA),
    clientB.auth.signInWithPassword(credentialsB),
  ]);
  if (loginA.error || loginB.error || !loginA.data.user || !loginB.data.user)
    throw new Error('One or both pre-existing QA users failed to authenticate');
  const a = loginA.data;
  const b = loginB.data;
  assert.notEqual(a.user.id, b.user.id, 'must use two independent user accounts');
  if (a.user.app_metadata?.study_pro_qa !== true ||
      b.user.app_metadata?.study_pro_qa !== true) {
    throw new Error('Refusing real user account: both must have admin-set app_metadata.study_pro_qa=true');
  }
  const { data: oldState, error: readError } = await clientA.from('configuracoes')
    .select('user_id').eq('user_id', a.user.id).maybeSingle();
  if (readError || oldState) {
    throw new Error('QA account A must have no existing app data; refusing to overwrite history');
  }

  // Independent GoTrue sessions for the same QA account on PC and phone.
  const pc = makeClient();
  const phone = makeClient();
  liveClients.push(pc,phone);
  const [pcAuth, phoneAuth] = await Promise.all([
    pc.auth.signInWithPassword(credentialsA),
    phone.auth.signInWithPassword(credentialsA),
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
    ...liveClients.map(client => client.auth.signOut()),
  ]);
  console.log('QA ACCOUNT CLEANUP REQUIRED: remove dedicated user A/B and their staging data via authorized admin workflow.');
});

import { criarBackupAutomaticoLocal, listarBackupsAutomaticosLocais, type BackupAutomaticoLocal, type MotivoBackupAutomatico } from './backupAutomaticoService';
import { SCHEMA_VERSION_ATUAL } from './schemaVersion';

const BANCO = 'study-pro-backups-seguranca';
function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Armazenamento de segurança indisponível.'));
    const pedido = indexedDB.open(BANCO, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore('backups', {keyPath: 'id'});
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
    pedido.onblocked = () => reject(new Error('Feche outras abas para liberar o armazenamento de segurança.'));
  });
}

/** Só libera a migração após a confirmação da transação. Não apaga dados para obter espaço. */
export async function criarBackupAutomaticoDuravel(usuarioId: string, estado: unknown, motivo: MotivoBackupAutomatico): Promise<BackupAutomaticoLocal> {
  try { return criarBackupAutomaticoLocal(usuarioId, estado, motivo); }
  catch {
    const dados = JSON.parse(JSON.stringify(estado));
    const backup: BackupAutomaticoLocal = {
      id: `idb-${crypto.randomUUID()}`, usuarioId, criadoEm: new Date().toISOString(), motivo,
      schemaVersionOrigem: dados?.schemaVersion ?? dados?.versao ?? 1,
      schemaVersionDestino: SCHEMA_VERSION_ATUAL, checksum: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(dados))))).map(b => b.toString(16).padStart(2, '0')).join(''), dados,
    };
    const db = await abrirBanco();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('backups', 'readwrite');
        const store = tx.objectStore('backups');
        // Retenção limitada por conta; remoções e gravação são atômicas.
        const lista = store.getAll();
        lista.onsuccess = () => {
          const antigos = (lista.result as BackupAutomaticoLocal[]).filter(b => b.usuarioId === usuarioId)
            .sort((a,b) => b.criadoEm.localeCompare(a.criadoEm));
          antigos.slice(9).forEach(b => store.delete(b.id));
          store.put(backup);
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Falha no backup de segurança.'));
        tx.onabort = () => reject(tx.error ?? new Error('Backup cancelado. Nenhuma migração foi liberada.'));
      });
    } finally { db.close(); }
    window.dispatchEvent(new Event('pmpe-backup-atualizado'));
    return backup;
  }
}

export async function listarBackupsAutomaticosDuraveis(usuarioId: string): Promise<BackupAutomaticoLocal[]> {
  let locais: BackupAutomaticoLocal[] = [];
  try { locais = listarBackupsAutomaticosLocais(usuarioId); } catch { /* armazenamento restrito */ }
  const db = await abrirBanco();
  try {
    const extras = await new Promise<BackupAutomaticoLocal[]>((resolve, reject) => {
      const pedido = db.transaction('backups', 'readonly').objectStore('backups').getAll();
      pedido.onsuccess = () => resolve(pedido.result.filter((b: BackupAutomaticoLocal) => b.usuarioId === usuarioId));
      pedido.onerror = () => reject(pedido.error);
    });
    return [...locais, ...extras].sort((a,b) => b.criadoEm.localeCompare(a.criadoEm));
  } finally { db.close(); }
}

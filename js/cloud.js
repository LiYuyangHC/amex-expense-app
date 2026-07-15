const Cloud = (() => {
  const cfg = window.APP_CONFIG || {};
  let client = null;
  let user = null;
  let syncPromise = null;
  let lastError = null;

  function available() {
    return Boolean(window.supabase?.createClient && cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY);
  }

  function init() {
    if (!available()) return null;
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
    });
    return client;
  }

  const normalizedEmail = value => String(value || "").trim().toLowerCase();
  const isAllowedUser = candidate => normalizedEmail(candidate?.email) === normalizedEmail(cfg.ALLOWED_EMAIL);

  async function enforceAllowedUser(session) {
    const candidate = session?.user || null;
    if (!candidate) { user = null; return null; }
    if (!isAllowedUser(candidate)) {
      await client.auth.signOut();
      user = null;
      throw new Error("此 Google Account 没有访问权限");
    }
    user = candidate;
    return candidate;
  }

  async function getSession() {
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    await enforceAllowedUser(data.session);
    return data.session;
  }

  const getUser = () => user;
  const isSignedIn = () => Boolean(user);
  const isSyncing = () => Boolean(syncPromise);
  const getLastError = () => lastError;

  async function signInWithGoogle() {
    if (!client) throw new Error("云端服务未加载");
    const redirectTo = `${location.origin}${location.pathname}`;
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { access_type: "offline", prompt: "select_account" } }
    });
    if (error) throw error;
  }

  async function signOut() {
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) throw error;
    user = null;
  }

  function onAuthStateChange(callback) {
    if (!client) return { unsubscribe() {} };
    const { data } = client.auth.onAuthStateChange(async (event, session) => {
      try {
        await enforceAllowedUser(session);
        callback(event, session, null);
      } catch (error) {
        lastError = error;
        callback(event, null, error);
      }
    });
    return data.subscription;
  }

  function recordClientTime(record) {
    return record.clientUpdatedAt || record.updatedAt || record.createdAt || new Date(0).toISOString();
  }

  function contentKey(record) {
    return [
      record.date || "",
      Number(record.amount || 0).toFixed(2),
      String(record.category || "").trim(),
      String(record.note || "").trim()
    ].join("\u001f");
  }

  function toCloudRow(record) {
    return {
      id: record.id,
      user_id: user.id,
      expense_date: record.date,
      amount: Number(record.amount),
      category: record.category,
      note: record.note || "",
      account_name: record.accountName || "建行 AMEX",
      created_at: record.createdAt || new Date().toISOString(),
      client_updated_at: recordClientTime(record),
      deleted: Boolean(record.deleted)
    };
  }

  function fromCloudRow(row) {
    return {
      id: row.id,
      date: row.expense_date,
      amount: Number(row.amount),
      category: row.category,
      note: row.note || "",
      accountName: row.account_name || "建行 AMEX",
      createdAt: row.created_at,
      updatedAt: row.client_updated_at || row.updated_at,
      clientUpdatedAt: row.client_updated_at || row.updated_at,
      serverUpdatedAt: row.updated_at,
      deleted: Boolean(row.deleted),
      syncState: "synced"
    };
  }

  const isNewer = (a, b) => new Date(a || 0).getTime() > new Date(b || 0).getTime();

  function deduplicateActive(records) {
    const groups = new Map();
    const output = records.map(record => ({ ...record }));
    for (const record of output) {
      if (record.deleted) continue;
      const key = contentKey(record);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    }

    const now = new Date().toISOString();
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      group.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")) || a.id.localeCompare(b.id));
      for (const duplicate of group.slice(1)) {
        duplicate.deleted = true;
        duplicate.updatedAt = now;
        duplicate.clientUpdatedAt = now;
        duplicate.syncState = "pending";
      }
    }
    return output;
  }

  async function fetchCloudRecords() {
    const { data, error } = await client.from("expenses").select("*");
    if (error) throw error;
    return (data || []).map(fromCloudRow);
  }

  function mergeById(localRecords, remoteRecords) {
    const localMap = new Map(localRecords.map(record => [record.id, record]));
    const remoteMap = new Map(remoteRecords.map(record => [record.id, record]));
    const ids = new Set([...localMap.keys(), ...remoteMap.keys()]);
    const merged = [];

    for (const id of ids) {
      const local = localMap.get(id);
      const remote = remoteMap.get(id);
      if (!local) { merged.push(remote); continue; }
      if (!remote) {
        if (local.syncState !== "synced") merged.push(local);
        continue;
      }

      const localTime = recordClientTime(local);
      const remoteTime = recordClientTime(remote);
      if (local.syncState !== "synced" && !isNewer(remoteTime, localTime)) merged.push(local);
      else if (isNewer(remoteTime, localTime)) merged.push(remote);
      else merged.push({ ...local, syncState: "synced", serverUpdatedAt: remote.serverUpdatedAt });
    }
    return merged;
  }

  async function pushRecordsInSafeOrder(records) {
    const pending = records.filter(record => record.syncState !== "synced");
    if (!pending.length) return;

    // The content-based unique index only applies to active rows. When a legacy
    // duplicate uses a different UUID, the old row must be tombstoned first;
    // otherwise Postgres may evaluate the active insert before the tombstone
    // update and reject the whole batch with a unique-constraint error.
    const tombstones = pending.filter(record => record.deleted);
    const active = pending.filter(record => !record.deleted);

    if (tombstones.length) {
      const { error } = await client
        .from("expenses")
        .upsert(tombstones.map(toCloudRow), { onConflict: "id" });
      if (error) throw error;
    }

    if (active.length) {
      const { error } = await client
        .from("expenses")
        .upsert(active.map(toCloudRow), { onConflict: "id" });
      if (error) throw error;
    }
  }

  async function performRecordSync(localRecords) {
    const remoteRecords = await fetchCloudRecords();
    let merged = mergeById(localRecords, remoteRecords);
    merged = deduplicateActive(merged);

    await pushRecordsInSafeOrder(merged);

    let canonical = deduplicateActive(await fetchCloudRecords());
    await pushRecordsInSafeOrder(canonical);

    // Fetch again only after all tombstones and active rows have been accepted,
    // so IndexedDB is replaced with the canonical server representation.
    canonical = (await fetchCloudRecords()).map(record => ({
      ...record,
      syncState: "synced"
    }));

    await DB.replaceAllRecords(canonical);
    return { records: canonical, changed: true };
  }

  async function syncRecords(localRecords) {
    if (!client || !user || !navigator.onLine) return { records: localRecords, changed: false };
    if (syncPromise) return syncPromise;

    syncPromise = (async () => {
      lastError = null;
      try {
        return await performRecordSync(localRecords);
      } catch (error) {
        lastError = error;
        throw error;
      } finally {
        syncPromise = null;
      }
    })();
    return syncPromise;
  }

  async function syncSettings(settings) {
    if (!client || !user || !navigator.onLine) return settings;
    const localTime = settings.clientUpdatedAt || settings.updatedAt || new Date(0).toISOString();
    const { data: remote, error: readError } = await client.from("user_settings").select("*").eq("user_id", user.id).maybeSingle();
    if (readError) throw readError;
    const remoteTime = remote?.client_updated_at || remote?.updated_at;
    if (remote && isNewer(remoteTime, localTime)) {
      return {
        accountName: remote.account_name || "建行 AMEX",
        billingStartDay: Number(remote.billing_start_day || 16),
        currency: remote.currency || "USD",
        updatedAt: remoteTime,
        clientUpdatedAt: remoteTime
      };
    }

    const payload = {
      user_id: user.id,
      account_name: settings.accountName || "建行 AMEX",
      billing_start_day: Number(settings.billingStartDay || 16),
      currency: settings.currency || "USD",
      client_updated_at: localTime
    };
    const { data, error } = await client.from("user_settings").upsert(payload, { onConflict: "user_id" }).select().single();
    if (error) throw error;
    return {
      accountName: data.account_name,
      billingStartDay: Number(data.billing_start_day),
      currency: data.currency,
      updatedAt: data.client_updated_at || data.updated_at,
      clientUpdatedAt: data.client_updated_at || data.updated_at
    };
  }

  return {
    init, getSession, getUser, isSignedIn, isSyncing, getLastError,
    signInWithGoogle, signOut, onAuthStateChange,
    syncRecords, syncSettings, contentKey
  };
})();

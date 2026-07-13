const Cloud = (() => {
  const cfg = window.APP_CONFIG || {};
  let client = null;
  let user = null;
  let syncing = false;
  let lastError = null;

  function available() {
    return Boolean(window.supabase?.createClient && cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY);
  }

  function init() {
    if (!available()) return null;
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce"
      }
    });
    return client;
  }

  function normalizedEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isAllowedUser(candidate) {
    return normalizedEmail(candidate?.email) === normalizedEmail(cfg.ALLOWED_EMAIL);
  }

  async function enforceAllowedUser(session) {
    const candidate = session?.user || null;
    if (!candidate) {
      user = null;
      return null;
    }
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

  function getUser() { return user; }
  function isSignedIn() { return Boolean(user); }
  function isSyncing() { return syncing; }
  function getLastError() { return lastError; }

  async function signInWithGoogle() {
    if (!client) throw new Error("云端服务未加载");
    const redirectTo = `${location.origin}${location.pathname}`;
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { access_type: "offline", prompt: "select_account" }
      }
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

  function isNewer(a, b) {
    return new Date(a || 0).getTime() > new Date(b || 0).getTime();
  }

  async function fetchCloudRecords() {
    const { data, error } = await client.from("expenses").select("*");
    if (error) throw error;
    return (data || []).map(fromCloudRow);
  }

  async function syncRecords(localRecords) {
    if (!client || !user || syncing || !navigator.onLine) return { records: localRecords, changed: false };
    syncing = true;
    lastError = null;
    try {
      const remoteRecords = await fetchCloudRecords();
      const remoteMap = new Map(remoteRecords.map(record => [record.id, record]));
      const merged = new Map();
      const toPush = [];

      for (const local of localRecords) {
        const remote = remoteMap.get(local.id);
        const localTime = recordClientTime(local);
        const remoteTime = remote ? recordClientTime(remote) : null;

        if (!remote) {
          merged.set(local.id, local);
          if (local.syncState !== "synced") toPush.push(local);
          continue;
        }

        remoteMap.delete(local.id);
        if (local.syncState !== "synced" && !isNewer(remoteTime, localTime)) {
          merged.set(local.id, local);
          toPush.push(local);
        } else if (isNewer(remoteTime, localTime)) {
          merged.set(remote.id, remote);
        } else {
          merged.set(local.id, { ...local, syncState: "synced", serverUpdatedAt: remote.serverUpdatedAt });
        }
      }

      for (const remote of remoteMap.values()) merged.set(remote.id, remote);

      if (toPush.length) {
        const { error } = await client.from("expenses").upsert(toPush.map(toCloudRow), { onConflict: "id" });
        if (error) throw error;
      }

      const canonical = await fetchCloudRecords();
      const canonicalMap = new Map(canonical.map(record => [record.id, record]));
      for (const [id, record] of merged) {
        if (!canonicalMap.has(id)) canonicalMap.set(id, record);
      }

      const records = [...canonicalMap.values()];
      await DB.saveRecords(records);
      return { records, changed: true };
    } catch (error) {
      lastError = error;
      throw error;
    } finally {
      syncing = false;
    }
  }

  async function syncSettings(settings) {
    if (!client || !user || !navigator.onLine) return settings;
    const localTime = settings.clientUpdatedAt || settings.updatedAt || new Date(0).toISOString();
    const { data: remote, error: readError } = await client
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
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
    const { data, error } = await client
      .from("user_settings")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single();
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
    syncRecords, syncSettings
  };
})();

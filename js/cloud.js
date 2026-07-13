const Cloud = (() => {
  const cfg = window.APP_CONFIG || {};
  let client = null;
  let user = null;
  let syncing = false;

  function available() {
    return Boolean(window.supabase?.createClient && cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY);
  }

  function init() {
    if (!available()) return null;
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return client;
  }

  async function getSession() {
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    user = data.session?.user || null;
    return data.session || null;
  }

  function getUser() { return user; }
  function isSignedIn() { return Boolean(user); }
  function isSyncing() { return syncing; }

  async function sendMagicLink(email) {
    if (!client) throw new Error("云端服务未加载");
    const redirectTo = `${location.origin}${location.pathname}`;
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true }
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
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      user = session?.user || null;
      callback(_event, session);
    });
    return data.subscription;
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
      updated_at: record.updatedAt || new Date().toISOString(),
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
      updatedAt: row.updated_at,
      deleted: Boolean(row.deleted),
      syncState: "synced"
    };
  }

  async function syncRecords(localRecords) {
    if (!client || !user || syncing || !navigator.onLine) return { records: localRecords, changed: false };
    syncing = true;
    try {
      const pending = localRecords.filter(record => record.syncState !== "synced");
      if (pending.length) {
        const { error } = await client.from("expenses").upsert(pending.map(toCloudRow), { onConflict: "id" });
        if (error) throw error;
      }

      const { data: cloudRows, error: pullError } = await client
        .from("expenses")
        .select("*")
        .order("updated_at", { ascending: false });
      if (pullError) throw pullError;

      const merged = new Map(localRecords.map(record => [record.id, record]));
      for (const row of cloudRows || []) {
        const cloudRecord = fromCloudRow(row);
        const localRecord = merged.get(cloudRecord.id);
        if (!localRecord || new Date(cloudRecord.updatedAt) >= new Date(localRecord.updatedAt || 0)) {
          merged.set(cloudRecord.id, cloudRecord);
        }
      }

      for (const record of pending) {
        const current = merged.get(record.id);
        if (current && new Date(current.updatedAt) <= new Date(record.updatedAt)) {
          merged.set(record.id, { ...record, syncState: "synced" });
        }
      }

      const records = [...merged.values()];
      await DB.saveRecords(records);
      return { records, changed: true };
    } finally {
      syncing = false;
    }
  }

  async function syncSettings(settings) {
    if (!client || !user || !navigator.onLine) return settings;
    const localUpdated = settings.updatedAt || new Date(0).toISOString();
    const { data: remote, error: readError } = await client
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) throw readError;

    if (remote && new Date(remote.updated_at) > new Date(localUpdated)) {
      return {
        accountName: remote.account_name || "建行 AMEX",
        billingStartDay: Number(remote.billing_start_day || 16),
        currency: remote.currency || "USD",
        updatedAt: remote.updated_at
      };
    }

    const payload = {
      user_id: user.id,
      account_name: settings.accountName || "建行 AMEX",
      billing_start_day: Number(settings.billingStartDay || 16),
      currency: settings.currency || "USD",
      updated_at: settings.updatedAt || new Date().toISOString()
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
      updatedAt: data.updated_at
    };
  }

  return {
    init, getSession, getUser, isSignedIn, isSyncing,
    sendMagicLink, signOut, onAuthStateChange,
    syncRecords, syncSettings
  };
})();

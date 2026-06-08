/* ============================================================
   VideoUp — API layer (Supabase CRUD)
   ทุกฟังก์ชันคืน Promise. ถ้า window.sb เป็น null (ยังไม่ตั้งค่า)
   จะ throw 'DEMO_MODE' ให้ฝั่ง UI fallback ไปใช้ mock data
   ============================================================ */
(function () {
  const demo = () => { throw new Error('DEMO_MODE'); };
  const ok   = (res) => { if (res.error) throw res.error; return res.data; };

  const API = {
    isLive: () => !!window.sb,

    /* ---------- AUTH ---------- */
    auth: {
      async current() {
        if (!window.sb) return null;
        const { data } = await window.sb.auth.getUser();
        return data.user;
      },
      async signUp({ email, password, name, plan }) {
        if (!window.sb) demo();
        return ok(await window.sb.auth.signUp({
          email, password,
          options: { data: { name, plan } },
        }));
      },
      async signIn({ email, password }) {
        if (!window.sb) demo();
        return ok(await window.sb.auth.signInWithPassword({ email, password }));
      },
      async signInWithGoogle() {
        if (!window.sb) demo();
        return ok(await window.sb.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: 'https://videoup-beta.vercel.app/index.html' },
        }));
      },
      async signOut() {
        if (window.sb) await window.sb.auth.signOut();
      },
    },

    /* ---------- PROFILE / SUBSCRIPTION ---------- */
    async getProfile() {
      if (!window.sb) demo();
      const u = await API.auth.current();
      return ok(await window.sb.from('profiles').select('*').eq('id', u.id).single());
    },
    async getSubscription() {
      if (!window.sb) demo();
      const u = await API.auth.current();
      const sub = ok(await window.sb.from('subscriptions').select('*').eq('user_id', u.id).maybeSingle());
      return sub;
    },
    async changePlan(planId) {
      if (!window.sb) demo();
      const u = await API.auth.current();
      await window.sb.from('profiles').update({ plan: planId }).eq('id', u.id);
      return ok(await window.sb.from('subscriptions')
        .upsert({ user_id: u.id, plan_id: planId, status: 'active' })
        .select().single());
    },

    /* ---------- SOURCES ---------- */
    async listSources() {
      if (!window.sb) demo();
      return ok(await window.sb.from('sources').select('*').order('created_at'));
    },

    // เริ่ม OAuth: เรียก Edge Function /start แล้วคืน authUrl ให้ redirect ไป
    async startSourceOAuth(provider) {
      if (!window.sb) demo();
      const { data: { session } } = await window.sb.auth.getSession();
      if (!session) throw new Error('กรุณาเข้าสู่ระบบก่อน');
      const res = await fetch(`${window.SUPABASE_URL}/functions/v1/oauth-source/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ provider, returnTo: window.location.origin + window.location.pathname }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'เริ่มเชื่อมต่อไม่สำเร็จ');
      return j.authUrl;
    },

    async disconnectSource(id) {
      if (!window.sb) demo();
      ok(await window.sb.from('sources').delete().eq('id', id));
    },

    async updateSourcePath(id, path) {
      if (!window.sb) demo();
      return ok(await window.sb.from('sources').update({ path }).eq('id', id).select().single());
    },

    /* ---------- PLATFORM CONNECTIONS ---------- */
    async listConnections() {
      if (!window.sb) demo();
      return ok(await window.sb.from('platform_connections').select('*'));
    },

    /* ---------- VIDEOS ---------- */
    // สแกนไฟล์วิดีโอจาก cloud source → บันทึกลงตาราง videos (เรียก Edge Function)
    async scanSource(sourceId) {
      if (!window.sb) demo();
      const { data: { session } } = await window.sb.auth.getSession();
      if (!session) throw new Error('กรุณาเข้าสู่ระบบก่อน');
      const res = await fetch(`${window.SUPABASE_URL}/functions/v1/scan-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ sourceId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'สแกนไฟล์ไม่สำเร็จ');
      return j; // { added, total }
    },

    // อัปโหลดไฟล์เข้า cloud source (ผ่าน Edge Function) → คืน video record
    async uploadToSource(sourceId, file) {
      if (!window.sb) demo();
      const { data: { session } } = await window.sb.auth.getSession();
      if (!session) throw new Error('กรุณาเข้าสู่ระบบก่อน');
      const fd = new FormData();
      fd.append('sourceId', sourceId);
      fd.append('file', file);
      const res = await fetch(`${window.SUPABASE_URL}/functions/v1/upload-source`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'อัปโหลดไม่สำเร็จ');
      return j.video;
    },

    async listVideos(sourceId) {
      if (!window.sb) demo();
      let q = window.sb.from('videos').select('*').eq('status', 'ready').order('created_at', { ascending: false });
      if (sourceId) q = q.eq('source_id', sourceId);
      return ok(await q);
    },

    /* ---------- COVER IMAGES (Supabase Storage: bucket 'covers') ---------- */
    // คืน public URL ของไฟล์ใน bucket (ไม่ throw — ใช้ได้แม้ demo)
    coverPublicUrl(path) {
      if (!window.sb || !path) return null;
      return window.sb.storage.from('covers').getPublicUrl(path).data.publicUrl;
    },

    // อัปโหลดรูปปก แล้วคืน { path, url }. เก็บที่ <user_id>/<videoId>.<ext>
    async uploadCover(videoId, file) {
      if (!window.sb) demo();
      const u = await API.auth.current();
      const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase();
      const path = `${u.id}/${videoId}.${ext}`;
      ok(await window.sb.storage.from('covers').upload(path, file, {
        upsert: true,
        contentType: file.type || 'image/jpeg',
        cacheControl: '3600',
      }));
      return { path, url: API.coverPublicUrl(path) };
    },

    // อัปโหลดรูป + บันทึก URL ลงคอลัมน์ videos.cover ในขั้นตอนเดียว
    async setVideoCover(videoId, file) {
      if (!window.sb) demo();
      const { path, url } = await API.uploadCover(videoId, file);
      ok(await window.sb.from('videos').update({ cover: url }).eq('id', videoId));
      return { path, url };
    },

    /* ---------- POSTS ---------- */
    async listPosts() {
      if (!window.sb) demo();
      return ok(await window.sb.from('posts_full').select('*').order('scheduled_at'));
    },

    // payload จาก CreatePost: { vid, platforms[], mode, when, title, cleanup, cleanupDelay, content{} }
    async createPost(payload) {
      if (!window.sb) demo();
      const u = await API.auth.current();
      const isNow = payload.mode === 'now';
      const post = ok(await window.sb.from('posts').insert({
        user_id: u.id,
        video_id: payload.vid,
        title: payload.title,
        mode: payload.mode,
        scheduled_at: isNow ? new Date().toISOString() : new Date(payload.scheduledISO).toISOString(),
        cleanup: payload.cleanup,
        cleanup_delay: payload.cleanupDelay,
        status: 'scheduled',
      }).select().single());

      const rows = payload.platforms.map(pl => ({
        post_id: post.id,
        platform: pl,
        caption: payload.content?.[pl]?.caption || '',
        hashtags: payload.content?.[pl]?.hashtags || '',
        affiliate_link: payload.content?.[pl]?.link || '',
        status: 'scheduled',
      }));
      ok(await window.sb.from('post_platforms').insert(rows));
      return post;
    },

    async deletePost(id) {
      if (!window.sb) demo();
      ok(await window.sb.from('posts').delete().eq('id', id));
    },

    async retryPlatform(postId, platform) {
      if (!window.sb) demo();
      ok(await window.sb.from('post_platforms')
        .update({ status: 'scheduled', error: null })
        .eq('post_id', postId).eq('platform', platform));
    },

    /* ---------- SETTINGS ---------- */
    async getSettings() {
      if (!window.sb) demo();
      const u = await API.auth.current();
      return ok(await window.sb.from('user_settings').select('*').eq('user_id', u.id).maybeSingle());
    },
    async saveSettings(patch) {
      if (!window.sb) demo();
      const u = await API.auth.current();
      return ok(await window.sb.from('user_settings')
        .upsert({ user_id: u.id, ...patch })
        .select().single());
    },

    /* ---------- REALTIME (สถานะอัปเดตจาก Pi) ---------- */
    subscribePosts(onChange) {
      if (!window.sb) return { unsubscribe() {} };
      const ch = window.sb.channel('posts-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'post_platforms' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, onChange)
        .subscribe();
      return { unsubscribe: () => window.sb.removeChannel(ch) };
    },
  };

  window.API = API;
})();

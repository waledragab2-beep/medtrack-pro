import * as Notifications from 'expo-notifications';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { io } from 'socket.io-client';
import { BrandHeader } from '../../components/BrandHeader';
import { Extras } from '../../components/Extras';
import { ReadyOverlay } from '../../components/ReadyOverlay';
import { Btn, Card } from '../../components/ui';
import { api, ApiError, type Content, type OrderStatus, type PublicBranch, type PublicBrand, type PublicOrder } from '../../lib/api';
import { API_URL } from '../../lib/config';
import { useI18n } from '../../lib/i18n';
import { registerPush } from '../../lib/push';
import { storage } from '../../lib/storage';
import { BRAND, palette, type Palette } from '../../lib/theme';

type Data = { serverTime: string; order: PublicOrder; brand: PublicBrand; branch: PublicBranch } & Content;

function clock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function OrderScreen() {
  const { orderId, k } = useLocalSearchParams<{ orderId: string; k?: string }>();
  const { t, lang } = useI18n();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [data, setData] = useState<Data | null>(null);
  const [problem, setProblem] = useState('');
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(Date.now());
  const prev = useRef<OrderStatus | null>(null);
  const seen = useRef(false);
  const skew = useRef(0);

  // Link with the per-order QR (?k=) if this phone is not linked yet.
  useEffect(() => {
    (async () => {
      const existing = await storage.token(orderId);
      if (existing) return setToken(existing);
      if (!k) return setToken(null);
      try {
        const r = await api<{ deviceToken: string }>(`/public/orders/${orderId}/claim`, { body: { secret: k, platform: Platform.OS === 'ios' ? 'ios' : 'android', locale: lang } });
        await storage.save(r.deviceToken, { orderId, linkedAt: new Date().toISOString() });
        void registerPush(r.deviceToken);
        setToken(r.deviceToken);
      } catch (e) {
        const err = e as ApiError;
        setProblem(err.code === 'order_already_linked' ? t('alreadyLinked') : err.code === 'network' ? t('networkError') : t('linkExpired'));
        setToken(null);
      }
    })();
  }, [orderId, k]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = useCallback((status: OrderStatus) => {
    if (status === 'ready' && prev.current !== 'ready' && !seen.current) setReady(true);
    if (status !== 'ready') setReady(false);
    prev.current = status;
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const d = await api<Data>(`/public/orders/${orderId}`, { device: token });
      skew.current = new Date(d.serverTime).getTime() - Date.now();
      setData(d);
      apply(d.order.status);
      void storage.update(orderId, { orderNumber: d.order.orderNumber, brandName: d.brand.name, branchSlug: d.branch.slug });
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401 || err.status === 403) {
        await storage.remove(orderId);
        setProblem(t('notLinked'));
        setToken(null);
      }
    }
  }, [token, orderId, apply, t]);

  // Realtime + resync on reconnect, on app foreground, on incoming push, and polling while disconnected.
  useEffect(() => {
    if (!token) return;
    void load();
    const socket = io(API_URL, { path: '/socket.io', auth: { deviceToken: token }, transports: ['websocket'] });
    socket.on('connect', () => void load());
    socket.on('order:status', () => void load());
    socket.on('order:reminder', () => {
      seen.current = false;
      setReady(true);
    });
    socket.on('order:unlinked', () => void load());
    const poll = setInterval(() => !socket.connected && void load(), 10000);
    const appState = AppState.addEventListener('change', (s) => s === 'active' && void load());
    const push = Notifications.addNotificationReceivedListener((n) => (n.request.content.data as any)?.orderId === orderId && void load());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      socket.close();
      clearInterval(poll);
      clearInterval(tick);
      appState.remove();
      push.remove();
    };
  }, [token, orderId, load]);

  if (token === null) {
    const p = palette(BRAND);
    return (
      <View style={[s.center, { backgroundColor: p.background, padding: 24, gap: 16 }]}>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center' }}>{problem || t('notLinked')}</Text>
        <Btn p={p} title={t('back')} onPress={() => router.replace('/')} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={[s.center, { backgroundColor: '#0A0A0A' }]}>
        <ActivityIndicator color="#E10600" />
      </View>
    );
  }

  const p = palette(data.brand.theme);
  const o = data.order;
  return (
    <View style={{ flex: 1, backgroundColor: p.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <BrandHeader brand={data.brand} p={p} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={{ padding: 16, gap: 16 }}>
          {o.status === 'preparing' ? <Preparing o={o} p={p} now={now + skew.current} /> : null}
          {o.status === 'ready' ? (
            <Pressable onPress={() => setReady(true)}>
              <Card p={p} style={{ backgroundColor: p.primary, borderColor: p.primary, alignItems: 'center' }}>
                <Text style={[s.ord, { color: '#fff' }]}>#{o.orderNumber}</Text>
                <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}>🔔 {t('statusReady')}</Text>
                <Text style={{ color: '#fff', fontSize: 17 }}>{t('statusReadySub')}</Text>
              </Card>
            </Pressable>
          ) : null}
          {o.status === 'picked_up' ? <Thanks o={o} p={p} brand={data.brand} token={token!} onDone={load} /> : null}
          {o.status === 'cancelled' ? (
            <Card p={p} style={{ alignItems: 'center' }}>
              <Text style={[s.ord, { color: p.text }]}>#{o.orderNumber}</Text>
              <Text style={{ color: p.text, fontSize: 20, fontWeight: '700' }}>{t('statusCancelled')}</Text>
            </Card>
          ) : null}
          {o.status === 'preparing' || o.status === 'ready' ? (
            <Card p={p}>
              <Text style={{ color: p.text, fontWeight: '700' }}>{o.pushEnabled ? `✅ ${t('alertsOn')}` : `🔕 ${t('alertsOff')}`}</Text>
              {!o.pushEnabled ? <Btn p={p} title={t('enableAlerts')} onPress={() => void registerPush(token!).then(load).then(() => Linking.openSettings().catch(() => {}))} /> : null}
              <Text style={{ color: p.muted, fontSize: 13 }}>{t('silentNote')}</Text>
            </Card>
          ) : null}
          <Extras brand={data.brand} branch={data.branch} content={data} p={p} />
        </View>
      </ScrollView>
      <ReadyOverlay
        visible={ready}
        orderNumber={o.orderNumber}
        p={p}
        sound={data.brand.alertSound}
        onDismiss={() => {
          seen.current = true;
          setReady(false);
        }}
      />
    </View>
  );
}

function Steps({ status, p }: { status: OrderStatus; p: Palette }) {
  const { t } = useI18n();
  const idx = status === 'preparing' ? 0 : status === 'ready' ? 1 : 2;
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
      {[t('step1'), t('step2'), t('step3')].map((label, i) => (
        <View key={label} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <View style={{ height: 6, width: '100%', borderRadius: 3, backgroundColor: i <= idx ? p.primary : p.line }} />
          <Text style={{ color: i <= idx ? p.text : p.muted, fontSize: 12, fontWeight: '600' }}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function Preparing({ o, p, now }: { o: PublicOrder; p: Palette; now: number }) {
  const { t } = useI18n();
  const remaining = o.estimatedReadyAt ? (new Date(o.estimatedReadyAt).getTime() - now) / 1000 : null;
  return (
    <Card p={p} style={{ alignItems: 'center' }}>
      <Text style={{ color: p.muted, fontSize: 16 }}>{t('order')}</Text>
      <Text style={[s.ord, { color: p.text }]}>#{o.orderNumber}</Text>
      <View style={[s.ring, { borderColor: p.line }]}>
        {remaining != null && remaining > 0 ? (
          <>
            <Text style={{ color: p.muted, fontSize: 12 }}>{t('estimatedIn')}</Text>
            <Text style={{ color: p.text, fontSize: 38, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{clock(remaining)}</Text>
          </>
        ) : (
          <Text style={{ color: p.text, fontWeight: '600' }}>{t('almostReady')}</Text>
        )}
      </View>
      <Text style={{ color: p.text, fontSize: 22, fontWeight: '800' }}>{t('statusPreparing')}</Text>
      <Text style={{ color: p.muted, textAlign: 'center' }}>{t('statusPreparingSub')}</Text>
      {o.queueAhead > 0 ? (
        <Text style={{ color: p.text, fontWeight: '600' }}>
          {o.queueAhead} {t('aheadOfYou')}
        </Text>
      ) : null}
      <Steps status="preparing" p={p} />
    </Card>
  );
}

function Thanks({ o, p, brand, token, onDone }: { o: PublicOrder; p: Palette; brand: PublicBrand; token: string; onDone: () => void }) {
  const { t } = useI18n();
  const [stars, setStars] = useState(o.rating?.stars ?? 0);
  const [busy, setBusy] = useState(false);
  return (
    <Card p={p} style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 44 }}>✅</Text>
      <Text style={{ color: p.text, fontSize: 22, fontWeight: '800' }}>{t('thanks')}</Text>
      <Text style={{ color: p.muted }}>
        {t('statusPicked')} • #{o.orderNumber}
      </Text>
      <Steps status="picked_up" p={p} />
      {o.rating ? (
        <Text style={{ color: p.text, fontWeight: '600' }}>{t('ratingThanks')}</Text>
      ) : (
        <>
          <Text style={{ color: p.text, fontWeight: '600' }}>{t('rateExperience')}</Text>
          <View style={{ flexDirection: 'row', gap: 8, direction: 'ltr' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setStars(n)} accessibilityRole="radio" accessibilityState={{ checked: n === stars }}>
                <Text style={{ fontSize: 40, color: n <= stars ? '#F5B301' : p.line }}>★</Text>
              </Pressable>
            ))}
          </View>
          {stars ? (
            <View style={{ alignSelf: 'stretch' }}>
              <Btn
                p={p}
                title={t('sendRating')}
                loading={busy}
                onPress={async () => {
                  setBusy(true);
                  await api(`/public/orders/${o.id}/rating`, { device: token, body: { stars } }).catch(() => {});
                  setBusy(false);
                  onDone();
                }}
              />
            </View>
          ) : null}
        </>
      )}
      {brand.googleReviewUrl ? (
        <View style={{ alignSelf: 'stretch' }}>
          <Btn
            p={p}
            variant="white"
            title={t('rateOnGoogle')}
            onPress={() => {
              void api(`/public/orders/${o.id}/review-click`, { device: token, method: 'POST' }).catch(() => {});
              void Linking.openURL(brand.googleReviewUrl!);
            }}
          />
        </View>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ord: { fontSize: 56, fontWeight: '800', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  ring: { width: 180, height: 180, borderRadius: 90, borderWidth: 10, alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
});

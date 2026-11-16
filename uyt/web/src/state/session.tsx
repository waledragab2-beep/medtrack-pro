import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, tokenStore } from '../lib/api';
import type { Branch, Brand, Membership, Role } from './types';

interface Me {
  user: { id: string; email: string; fullName: string; locale: string };
  memberships: Membership[];
}

interface Session {
  status: 'loading' | 'anonymous' | 'ready';
  me: Me | null;
  brandId: string | null;
  brand: Brand | null;
  branches: Branch[];
  role: Role | null;
  /** branch restriction of the current member (cashier assigned to one branch) */
  lockedBranchId: string | null;
  branchId: string | null;
  setBrandId: (id: string) => void;
  setBranchId: (id: string) => void;
  signIn: (r: { accessToken: string; refreshToken: string } & Me) => void;
  signOut: () => Promise<void>;
  reloadBrand: () => Promise<void>;
  setBrand: (b: Brand) => void;
}

const Ctx = createContext<Session | null>(null);
const BRAND_KEY = 'uyt.brand';
const BRANCH_KEY = 'uyt.branch';
const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Session['status']>(tokenStore.get() ? 'loading' : 'anonymous');
  const [me, setMe] = useState<Me | null>(null);
  const [brandId, setBrandIdState] = useState<string | null>(ls.get(BRAND_KEY));
  const [brand, setBrand] = useState<Brand | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  const [lockedBranchId, setLocked] = useState<string | null>(null);
  const [branchId, setBranchIdState] = useState<string | null>(ls.get(BRANCH_KEY));

  const loadMe = useCallback(async () => {
    if (!tokenStore.get()) {
      setStatus('anonymous');
      setMe(null);
      return;
    }
    try {
      const m = await api<Me>('/me');
      setMe(m);
      const valid = m.memberships.find((x) => x.brandId === ls.get(BRAND_KEY)) ?? m.memberships[0];
      setBrandIdState(valid?.brandId ?? null);
      setStatus('ready');
    } catch (e: any) {
      if (e.status === 401) {
        tokenStore.set(null);
        setStatus('anonymous');
      } else {
        // offline: keep the user on the board with cached state
        setStatus((s) => (s === 'loading' ? 'ready' : s));
      }
    }
  }, []);

  useEffect(() => {
    void loadMe();
    const onTokens = () => !tokenStore.get() && setStatus('anonymous');
    window.addEventListener('uyt:tokens', onTokens);
    return () => window.removeEventListener('uyt:tokens', onTokens);
  }, [loadMe]);

  const reloadBrand = useCallback(async () => {
    if (!brandId || status !== 'ready') return;
    const r = await api<{ brand: Brand; branches: Branch[]; role: Role; branchId: string | null }>(`/brands/${brandId}`);
    setBrand(r.brand);
    setBranches(r.branches);
    setRole(r.role);
    setLocked(r.branchId);
    setBranchIdState((cur) => {
      const pick = r.branchId ?? (r.branches.find((b) => b.id === cur && b.isActive) ?? r.branches.find((b) => b.isActive) ?? r.branches[0])?.id ?? null;
      if (pick) ls.set(BRANCH_KEY, pick);
      return pick;
    });
  }, [brandId, status]);

  useEffect(() => {
    void reloadBrand().catch(() => {});
  }, [reloadBrand]);

  const value = useMemo<Session>(
    () => ({
      status,
      me,
      brandId,
      brand,
      branches,
      role,
      lockedBranchId,
      branchId,
      setBrandId: (id) => {
        ls.set(BRAND_KEY, id);
        setBrand(null);
        setBrandIdState(id);
      },
      setBranchId: (id) => {
        ls.set(BRANCH_KEY, id);
        setBranchIdState(id);
      },
      signIn: (r) => {
        tokenStore.set({ accessToken: r.accessToken, refreshToken: r.refreshToken });
        setMe({ user: r.user, memberships: r.memberships });
        const first = r.memberships[0]?.brandId ?? null;
        if (first) ls.set(BRAND_KEY, first);
        setBrandIdState(first);
        setStatus('ready');
      },
      signOut: async () => {
        const t = tokenStore.get();
        if (t) await api('/auth/logout', { body: { refreshToken: t.refreshToken } }).catch(() => {});
        tokenStore.set(null);
        setMe(null);
        setBrand(null);
        setStatus('anonymous');
      },
      reloadBrand,
      setBrand,
    }),
    [status, me, brandId, brand, branches, role, lockedBranchId, branchId, reloadBrand],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const v = useContext(Ctx);
  if (!v) throw new Error('SessionProvider missing');
  return v;
}

export const isAdmin = (r: Role | null) => r === 'owner' || r === 'manager';

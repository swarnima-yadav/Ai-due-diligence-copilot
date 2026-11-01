import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, enc } from "./api";

const Ctx = createContext();
export const useApp = () => useContext(Ctx);
const EMPTY = { docs: [], reps: [], risk: null, growth: null };

export function AppProvider({ children }) {
  const [companies, setCompanies] = useState([]);
  const [company, setCompany] = useState(null);
  const [data, setData] = useState(EMPTY);
  const [toasts, setToasts] = useState([]);
  const [source, setSource] = useState(null);
  const [chats, setChats] = useState({});
  const [asked, setAsked] = useState(0);
  const [query, setQuery] = useState("");

  const toast = useCallback((msg, err) => {
    const id = Math.random();
    setToasts((t) => [...t, { id, msg, err }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const load = useCallback(async (name) => {
    if (!name) return setData(EMPTY);
    const [d, r] = await Promise.all([api(`/companies/${enc(name)}/documents`), api(`/companies/${enc(name)}/reports`)]);
    const out = { docs: d.documents, reps: r.reports, risk: null, growth: null };
    for (const k of ["risk", "growth"]) {
      const x = r.reports.find((z) => z.kind === k);
      if (x) out[k] = (await api(`/reports/${x.id}`)).content;
    }
    setData(out);
  }, []);

  const refresh = useCallback(async (pick) => {
    const { companies: cs } = await api("/companies/details");
    setCompanies(cs);
    const want = pick || company;
    const name = cs.find((c) => c.name === want) ? want : cs[0]?.name || null;
    setCompany(name);
    await load(name);
  }, [company, load]);

  useEffect(() => { refresh().catch((e) => toast(e.message, true)); }, []); // eslint-disable-line

  const select = async (n) => { setCompany(n); await load(n); };
  const reload = () => load(company);

  return (
    <Ctx.Provider value={{ companies, company, ...data, setData, refresh, reload, select, toast, toasts, source, setSource, chats, setChats, asked, setAsked, query, setQuery }}>
      {children}
    </Ctx.Provider>
  );
}

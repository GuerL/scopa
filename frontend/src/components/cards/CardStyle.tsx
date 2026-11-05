import { createContext, useContext, useState, type ReactNode } from 'react';

type CardStyle = 'modern' | 'traditional';
const storageKey = 'scopa.cardStyle';
const Context = createContext<{ style: CardStyle; setStyle: (style: CardStyle) => void }>({ style: 'modern', setStyle: () => {} });

export function CardStyleProvider({ children, persist = true }: { children: ReactNode; persist?: boolean }) {
  const [style, update] = useState<CardStyle>(() => {
    if (!persist) return 'modern';
    try { return localStorage.getItem(storageKey) === 'traditional' ? 'traditional' : 'modern'; }
    catch { return 'modern'; }
  });
  function setStyle(next: CardStyle) {
    update(next);
    if (!persist) return;
    try { localStorage.setItem(storageKey, next); } catch { /* Storage may be unavailable. */ }
  }
  return <Context.Provider value={{ style, setStyle }}>{children}</Context.Provider>;
}

export function useCardStyle() { return useContext(Context); }

export function CardStyleSelector() {
  const { style, setStyle } = useCardStyle();
  return <div className="card-style-setting">
    <label htmlFor="card-style">Cards</label>
    <select id="card-style" value={style} onChange={event => setStyle(event.target.value as CardStyle)}>
      <option value="modern">Modern</option>
      <option value="traditional">Traditional</option>
    </select>
    {style === 'traditional' && <a href="/cards/sicilian/ATTRIBUTION.html" target="_blank" rel="noreferrer">Artwork credits</a>}
  </div>;
}

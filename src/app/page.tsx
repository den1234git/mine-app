"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, query, orderBy, limit, getDocs, addDoc, doc, updateDoc, increment } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { Ore } from "@/lib/types";

function OreCard({ ore, onEmpathy }: { ore: Ore; onEmpathy: (id: string) => void }) {
  const [voted, setVoted] = useState(false);

  const handleEmpathy = () => {
    if (voted) return;
    setVoted(true);
    onEmpathy(ore.id);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <p className="text-base leading-relaxed whitespace-pre-wrap">{ore.body}</p>
      {ore.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {ore.tags.map((tag) => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-muted">
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={handleEmpathy}
          disabled={voted}
          className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full transition-colors ${
            voted
              ? "bg-amber-400/20 text-amber-400"
              : "bg-zinc-800 text-muted hover:bg-zinc-700 hover:text-foreground"
          }`}
        >
          👍 わかる {ore.empathyCount + (voted ? 1 : 0)}
        </button>
        {ore.companyNames.length > 0 && (
          <div className="flex gap-1.5">
            {ore.companyNames.map((name) => (
              <span key={name} className="text-xs text-muted">🏢 {name}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PostForm({ onPost }: { onPost: (body: string, tags: string) => Promise<void> }) {
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [posting, setPosting] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSubmit = async () => {
    if (!body.trim() || posting) return;
    setPosting(true);
    try {
      await onPost(body.trim(), tags.trim());
      setBody("");
      setTags("");
      setOpen(false);
    } finally {
      setPosting(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-card border border-border rounded-xl p-4 text-left text-muted hover:border-accent/50 transition-colors"
      >
        ⛏ 不満を投げ込む...
      </button>
    );
  }

  return (
    <div className="bg-card border border-accent/50 rounded-xl p-4 space-y-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="「〇〇が〇〇でクソだった」まで砕いて書く。個人名はNG、企業名・製品名はOK。"
        rows={4}
        autoFocus
        className="w-full bg-transparent border-none outline-none resize-none text-base placeholder:text-muted/60"
      />
      <input
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="タグ（カンマ区切り）: UX, 配送, カスタマーサポート"
        className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted/60"
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setOpen(false)}
          className="px-4 py-2 text-sm text-muted hover:text-foreground"
        >
          キャンセル
        </button>
        <button
          onClick={handleSubmit}
          disabled={!body.trim() || posting}
          className="px-4 py-2 text-sm bg-accent text-zinc-950 font-medium rounded-lg hover:bg-amber-300 disabled:opacity-50 transition-colors"
        >
          {posting ? "投稿中..." : "投げ込む"}
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [ores, setOres] = useState<Ore[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOres = useCallback(async () => {
    const isFirebaseConfigured = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (isFirebaseConfigured) {
      try {
        const q = query(collection(getDb(), "ores"), orderBy("empathyCount", "desc"), limit(50));
        const snapshot = await getDocs(q);
        setOres(
          snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as Ore[]
        );
        setLoading(false);
        return;
      } catch {
        // fall through to demo data
      }
    }
    setOres([
        {
          id: "demo-1",
          body: "Amazonの返品、理由選択が20個もあるのに「その他」を選ばないと自由記述できない。結局毎回「その他」。",
          tags: ["UX", "EC"],
          companyNames: ["Amazon"],
          empathyCount: 42,
          createdAt: Date.now(),
          authorId: "demo",
        },
        {
          id: "demo-2",
          body: "銀行のワンタイムパスワードアプリ、機種変したら再登録に窓口行かないといけない。2024年にもなって。",
          tags: ["銀行", "認証"],
          companyNames: [],
          empathyCount: 128,
          createdAt: Date.now(),
          authorId: "demo",
        },
        {
          id: "demo-3",
          body: "病院の予約、電話でしか取れないのに電話が永遠に繋がらない。Web予約あるのに初診は電話のみ。",
          tags: ["医療", "予約"],
          companyNames: [],
          empathyCount: 89,
          createdAt: Date.now(),
          authorId: "demo",
        },
      ]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOres();
  }, [fetchOres]);

  const handlePost = async (body: string, tagsStr: string) => {
    const tags = tagsStr
      .split(/[,、]/)
      .map((t) => t.trim())
      .filter(Boolean);

    const companyNames: string[] = [];

    const ore = {
      body,
      tags,
      companyNames,
      empathyCount: 0,
      createdAt: Date.now(),
      authorId: "anonymous",
    };

    try {
      const docRef = await addDoc(collection(getDb(), "ores"), ore);
      setOres((prev) => [{ ...ore, id: docRef.id }, ...prev]);
    } catch {
      setOres((prev) => [{ ...ore, id: `local-${Date.now()}` }, ...prev]);
    }
  };

  const handleEmpathy = async (id: string) => {
    setOres((prev) =>
      prev.map((o) => (o.id === id ? { ...o, empathyCount: o.empathyCount + 1 } : o))
    );
    try {
      await updateDoc(doc(getDb(), "ores", id), { empathyCount: increment(1) });
    } catch {
      // offline or demo mode
    }
  };

  return (
    <div className="space-y-4">
      <PostForm onPost={handlePost} />

      <div className="flex items-center gap-2 pt-2">
        <span className="text-accent text-lg">⛏</span>
        <h2 className="text-sm font-medium text-muted">
          原石 — 共感順
        </h2>
      </div>

      {loading ? (
        <div className="text-center text-muted py-12">掘削中...</div>
      ) : (
        <div className="space-y-3">
          {ores.map((ore) => (
            <OreCard key={ore.id} ore={ore} onEmpathy={handleEmpathy} />
          ))}
        </div>
      )}
    </div>
  );
}

// Server-only: English translation of notes via DeepL.
// Needs DEEPL_API_KEY (a free key ends in ":fx"). Without a key, notes are saved untranslated.

export type Translation = { lang: string | null; english: string | null };

export async function translateToEnglish(text: string): Promise<Translation> {
  const key = process.env.DEEPL_API_KEY;
  if (!key || !text.trim()) return { lang: null, english: null };
  const host = key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
  try {
    const res = await fetch(`${host}/v2/translate`, {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: [text], target_lang: "EN-GB" }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return { lang: null, english: null };
    const json = (await res.json()) as { translations?: { detected_source_language: string; text: string }[] };
    const t = json.translations?.[0];
    if (!t) return { lang: null, english: null };
    const lang = t.detected_source_language.toLowerCase();
    // Already English: keep the language, no translation needed.
    if (lang === "en") return { lang, english: null };
    return { lang, english: t.text.slice(0, 8000) };
  } catch {
    return { lang: null, english: null };
  }
}

const NAMES: Record<string, string> = {
  sv: "Swedish", da: "Danish", nb: "Norwegian", no: "Norwegian", fi: "Finnish", de: "German", fr: "French",
  es: "Spanish", it: "Italian", nl: "Dutch", pt: "Portuguese", pl: "Polish", et: "Estonian", lv: "Latvian",
  lt: "Lithuanian", cs: "Czech", sk: "Slovak", sl: "Slovenian", hu: "Hungarian", ro: "Romanian", bg: "Bulgarian",
  el: "Greek", tr: "Turkish", uk: "Ukrainian", ru: "Russian", ja: "Japanese", zh: "Chinese", ko: "Korean",
  id: "Indonesian", ar: "Arabic",
};

export function languageName(code: string | null | undefined) {
  if (!code) return "another language";
  return NAMES[code.toLowerCase()] ?? code.toUpperCase();
}

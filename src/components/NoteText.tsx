import { languageName } from "@/lib/translate";

type Props = { note: string; lang?: string | null; english?: string | null; size?: number };

/** A note in its original language, with the English translation underneath when there is one. */
export function NoteText({ note, lang, english, size = 16 }: Props) {
  return (
    <div className="stack gap-8">
      <p style={{ whiteSpace: "pre-line", fontSize: size }} lang={lang ?? undefined}>{note}</p>
      {english ? (
        <div className="translation" lang="en">
          <span className="translation-label">Translated from {languageName(lang)}</span>
          <p style={{ whiteSpace: "pre-line" }}>{english}</p>
        </div>
      ) : null}
    </div>
  );
}

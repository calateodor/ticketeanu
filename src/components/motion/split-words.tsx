// Titlu care intră cuvânt cu cuvânt. Textul întreg rămâne pentru cititoarele de ecran (sr-only);
// cuvintele despărțite sunt doar decor (aria-hidden). Fără JS, cuvintele stau la locul lor, vizibile.
// Rânduri: separă cu „\n” ca să forțezi trecerea pe rândul următor.
// wordClassName se pune pe fiecare cuvânt: un gradient pe text (.text-sunset) pus pe container nu trece
// prin cuvintele animate separat, care sunt inline-block cu transform.
export function SplitWords({ text, className, wordClassName }: { text: string; className?: string; wordClassName?: string }) {
  const lines = text.split("\n");
  return (
    <>
      <span className="sr-only">{lines.join(" ")}</span>
      <span aria-hidden="true" className={className}>
        {lines.map((line, li) => (
          <span key={li} className="block">
            {line.split(" ").map((w, wi) => (
              // Spațiul stă între măști: în interiorul unui inline-block, browserul l-ar tăia.
              <span key={wi}>
                {wi > 0 ? " " : null}
                <span className="split-mask">
                  <span className={wordClassName ? `split-w ${wordClassName}` : "split-w"}>{w}</span>
                </span>
              </span>
            ))}
          </span>
        ))}
      </span>
    </>
  );
}
